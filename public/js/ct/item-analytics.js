(() => {
  const productImages = document.querySelectorAll('[data-ct-product-image]');

  productImages.forEach((image) => {
    let fallbackImages = [];
    try {
      fallbackImages = JSON.parse(image.dataset.fallbackImages || '[]');
    } catch (error) {
      fallbackImages = [];
    }

    const showPlaceholder = () => {
      image.classList.add('d-none');
      if (image.parentElement && image.parentElement.matches('.ct-product-image-link')) {
        image.parentElement.classList.add('d-none');
      }

      const productMedia = image.closest('.ct-product-media');
      const placeholder = productMedia
        ? productMedia.querySelector('.ct-product-image-placeholder')
        : null;
      if (placeholder) {
        placeholder.classList.remove('d-none');
      }
    };

    const loadNextImage = () => {
      const nextImage = fallbackImages.shift();
      if (nextImage) {
        image.src = nextImage;
        return;
      }
      showPlaceholder();
    };

    image.addEventListener('error', loadNextImage);
    if (image.complete && image.naturalWidth === 0) {
      loadNextImage();
    }
  });
})();
