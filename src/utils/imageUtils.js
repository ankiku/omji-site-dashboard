/**
 * Client-side image compression utility.
 * Resizes images to a max dimension and converts to WebP using the Canvas API.
 * Falls back gracefully if the browser doesn't support WebP blobs.
 *
 * @param {File} file - The original image File object
 * @param {number} [maxPx=1920] - Max width/height in pixels
 * @param {number} [quality=0.85] - WebP quality 0-1
 * @returns {Promise<File>} - Compressed File (WebP if supported, else JPEG)
 */
export async function compressImage(file, maxPx = 1920, quality = 0.85) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Downscale only if needed
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height / width) * maxPx);
          width = maxPx;
        } else {
          width = Math.round((width / height) * maxPx);
          height = maxPx;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Try WebP first, fall back to JPEG
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const name = file.name.replace(/\.[^.]+$/, '.webp');
            resolve(new File([blob], name, { type: 'image/webp' }));
          } else {
            // WebP not supported — try JPEG
            canvas.toBlob(
              (jpegBlob) => {
                if (jpegBlob) {
                  const name = file.name.replace(/\.[^.]+$/, '.jpg');
                  resolve(new File([jpegBlob], name, { type: 'image/jpeg' }));
                } else {
                  resolve(file); // final fallback
                }
              },
              'image/jpeg',
              quality
            );
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback: use original
    };

    img.src = url;
  });
}
