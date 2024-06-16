const express = require('express');
const request = require('request');
const cors = require('cors');
const querystring = require('querystring');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Variables de configuration Spotify
const client_id = 'ab38fa7ffee345148113bb033bdffc51'; // Remplacez par votre Client ID Spotify
const client_secret = '3b92a082aed74371a7f5b0c9f0a3409c'; // Remplacez par votre Client Secret Spotify
const redirect_uri = 'https://lucky.freeboxos.fr:8443/selectword.html/callback'; // Assurez-vous que cette URI de redirection est configurée dans le tableau de bord Spotify

// Données partagées pour les éditeurs
let editorData = {
    editor1: '',
    editor2: '',
    editor3: '',
    editor4: ''
};

let scores = {
    editor1: 0,
    editor2: 0,
    editor3: 0,
    editor4: 0
};
const editorNames = {
    editor1: 'Lucas',
    editor2: 'Autre nom',
    editor3: 'Encore un autre nom',
    editor4: 'Et un dernier nom'
};


let chosenWord = '';
let currentTrackInfo = {
    title: '',
    artist: '',
    albumCover: ''
};

// Gestion de l'état des playlists
let playlists = {};
let playlistTracks = {};

// Routes pour les éditeurs
app.post('/login', (req, res) => {
    const editorNumber = req.body.editorNumber;
    if (editorNumber && editorNumber >= 1 && editorNumber <= 4) {
        res.redirect(`/editor${editorNumber}`);
    } else {
        res.status(400).send('Invalid editor number.');
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/selectWord', (req, res) => {
    res.sendFile(path.join(__dirname, 'selectWord.html'));
});

app.get('/editor1', (req, res) => {
    if (!chosenWord) {
        res.redirect('/waiting?editor=editor1');
    } else {
        res.sendFile(path.join(__dirname, 'editor1.html'));
    }
});

app.get('/editor2', (req, res) => {
    if (!chosenWord) {
        res.redirect('/waiting?editor=editor2');
    } else {
        res.sendFile(path.join(__dirname, 'editor2.html'));
    }
});

app.get('/editor3', (req, res) => {
    if (!chosenWord) {
        res.redirect('/waiting?editor=editor3');
    } else {
        res.sendFile(path.join(__dirname, 'editor3.html'));
    }
});

app.get('/editor4', (req, res) => {
    if (!chosenWord) {
        res.redirect('/waiting?editor=editor4');
    } else {
        res.sendFile(path.join(__dirname, 'editor4.html'));
    }
});

app.get('/waiting', (req, res) => {
    res.sendFile(path.join(__dirname, 'waiting.html'));
});

app.get('/current-track-info', (req, res) => {
    res.json(currentTrackInfo);
});

app.post('/setWord', (req, res) => {
    const word = req.body.word;
    if (word) {
        chosenWord = word;
        io.emit('wordSelected', word);
        res.redirect('/selectWord');
    } else {
        res.status(400).send('Invalid word.');
    }
});

// Routes pour Spotify
app.get('/spotify-login', (req, res) => {
    const scope = 'user-read-private user-read-email';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
        }));
});

app.get('/selectword.html/callback', (req, res) => {
    const code = req.query.code || null;
    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        form: {
            code: code,
            redirect_uri: redirect_uri,
            grant_type: 'authorization_code',
        },
        headers: {
            'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
        },
        json: true,
    };
    request.post(authOptions, (error, response, body) => {
        const access_token = body.access_token;
        res.redirect(`/selectword.html?access_token=${access_token}`);
    });
});

app.get('/refresh_token', (req, res) => {
    const refresh_token = req.query.refresh_token;
    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
        },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token,
        },
        json: true,
    };
    request.post(authOptions, (error, response, body) => {
        const access_token = body.access_token;
        res.send({
            'access_token': access_token,
        });
    });
});

// Socket.io pour collaboration en temps réel
io.on('connection', (socket) => {
    console.log('New client connected');

    // Envoyer les informations de la piste actuelle à chaque nouvelle connexion
    socket.emit('currentTrackInfo', currentTrackInfo);
    socket.emit('updateScores', scores,editorNames ); // Envoyer le classement à chaque nouvelle connexion

    socket.on('wordSelected', (word) => {
        chosenWord = word;
        io.emit('wordSelected', word); // Notifier tous les clients du mot sélectionné
    });

    // Écouter l'événement 'currentTrack' et mettre à jour les informations de la piste
    socket.on('currentTrack', (trackInfo) => {
        if (trackInfo && Object.keys(trackInfo).length !== 0) {
            console.log('Received current track info:', trackInfo);

            // Mettre à jour les informations de la piste
            currentTrackInfo = {
                title: trackInfo.title,
                artist: trackInfo.artist,
                albumCover: trackInfo.albumCover
            };

            // Diffuser les informations de la piste à tous les clients
            io.emit('currentTrackInfo', currentTrackInfo);
        }
    });

    socket.on('editorUpdate', ({ editor, content }) => {
        editorData[editor] = content;
        socket.to(editor).emit('editorContent', { editor, content });

        if (chosenWord && content.includes(chosenWord)) {
            scores[editor]++;

            chosenWord = '';
            io.emit('clearEditors');
            io.emit('resetWord');
            io.emit('updateScores', scores);
            console.log(scores);

            io.emit('redirectToWaiting');
        }
    });
// Nouvelle route pour réinitialiser le mot
    app.post('/resetWord', (req, res) => {
        chosenWord = '';
        io.emit('resetWord');
        io.emit('redirectToWaiting');
        res.sendStatus(200);
    });



    socket.on('joinRoom', (room) => {
        socket.join(room);
        socket.emit('editorContent', { editor: room, content: editorData[room] });
    });

    socket.on('newUser', (username) => {
        socket.username = username;
        io.emit('userList', Object.keys(io.sockets.sockets).map(socketId => io.sockets.sockets[socketId].username));
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 8888;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
