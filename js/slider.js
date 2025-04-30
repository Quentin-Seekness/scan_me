document.addEventListener("DOMContentLoaded", function() {
    const images = [
        'assets/img/thumbnail_Carte1.png',
        'assets/img/thumbnail_Carte2.png',
        'assets/img/thumbnail_Carte3.png',
        'assets/img/thumbnail_Verso.png'
    ];

    let currentIndex = 0;

    const carouselImage = document.getElementById('carouselImage');
    const leftArrow = document.querySelector('.arrow-left');
    const rightArrow = document.querySelector('.arrow-right');

    function updateImage() {
        carouselImage.src = images[currentIndex];
    }

    leftArrow.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        updateImage();
    });

    rightArrow.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % images.length;
        updateImage();
    });

    // Initial load
    updateImage();
});