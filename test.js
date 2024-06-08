document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const playlistIds = ['37i9dQZEVXbIPWwFssbupI', '6UUylRo0sCYh0PDna1pC2d', 'playlistId3']; // Ajoutez ici les ID de toutes les playlists que vous souhaitez afficher
    const apiEndpoint = 'https://api.spotify.com/v1/playlists/';

    const playlistContainer = document.getElementById('playlist-container');
    const audioPlayer = document.getElementById('audio-player');
    const artistName = document.getElementById('artist-name'); // Récupération de l'élément pour afficher le nom de l'artiste


    if (!accessToken) {
        window.location.href = 'http://localhost:8888/spotify-login';
        return;
    }

    try {
        for (const playlistId of playlistIds) {
            const response = await fetch(`${apiEndpoint}${playlistId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            const playlist = await response.json();
            displayPlaylistCover(playlist);
        }
    } catch (error) {
        console.error('Error fetching playlist:', error);
    }

    function displayPlaylistCover(playlist) {
        const playlistDiv = document.createElement('div'); // Créer un élément <div> pour contenir l'image et le nom de la playlist
        playlistDiv.classList.add('playlist-item'); // Ajouter une classe au conteneur de la playlist

        const coverUrl = playlist.images[0].url;
        const coverElement = document.createElement('img');
        coverElement.src = coverUrl;
        coverElement.alt = playlist.name;
        coverElement.classList.add('playlist-cover');
        coverElement.addEventListener('click', () => playRandomTrack(playlist.tracks.items));

        const playlistName = document.createElement('p'); // Créer un élément <p> pour afficher le nom de la playlist
        playlistName.textContent = playlist.name;
        playlistName.classList.add('playlist-name'); // Ajouter une classe au nom de la playlist

        playlistDiv.appendChild(coverElement); // Ajouter l'image de la couverture à l'élément <div>
        playlistDiv.appendChild(playlistName); // Ajouter le nom de la playlist à l'élément <div>

        playlistContainer.appendChild(playlistDiv); // Ajouter l'élément <div> contenant l'image et le nom de la playlist au conteneur principal
    }

    function playRandomTrack(tracks) {
        if (tracks.length === 0) return;

        const randomIndex = Math.floor(Math.random() * tracks.length);
        const randomTrack = tracks[randomIndex].track;

        if (randomTrack.preview_url) {
            audioPlayer.src = randomTrack.preview_url;
            audioPlayer.play();

            const trackInfo = {
                title: randomTrack.name,
                artist: randomTrack.artists[0].name,
                albumCover: randomTrack.album.images[0].url
            };

            // Émettre l'événement Socket.io pour envoyer les informations de la piste en cours
            socket.emit('currentTrack', trackInfo);

            tracks.splice(randomIndex, 1); // Supprimer la piste jouée du tableau

            // Émettre l'événement Socket.io pour mettre à jour le mot sélectionné
            socket.emit('wordSelected', randomTrack.artists[0].name.toLowerCase());

            audioPlayer.addEventListener('ended', () => {
                playRandomTrack(tracks); // Jouer la piste suivante aléatoire lorsque la piste actuelle se termine
            }, { once: true });
        } else {
            // Si la piste sélectionnée n'a pas de prévisualisation, en essayer une autre
            playRandomTrack(tracks);
        }
    }
});
