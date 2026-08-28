import { Service } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const TARGET_SIZE = 384;
const MAX_STORED_BYTES = 160 * 1024;

@Service()
export class PhotoService {
  async choose(): Promise<string | undefined> {
    return this.capture(CameraSource.Photos);
  }
  async take(): Promise<string | undefined> {
    return this.capture(CameraSource.Camera);
  }

  async readBrowserFile(file: File): Promise<string> {
    this.validateSource(file);
    return this.optimize(file);
  }

  private async capture(source: CameraSource): Promise<string | undefined> {
    try {
      const result = await Camera.getPhoto({
        source,
        resultType: CameraResultType.Uri,
        quality: 90,
        width: 2048,
        height: 2048,
        allowEditing: true,
        correctOrientation: true,
        saveToGallery: false,
      });
      if (!result.webPath) throw new Error('The selected photo could not be opened.');
      const response = await fetch(result.webPath);
      if (!response.ok) throw new Error('The selected photo could not be opened.');
      const sourcePhoto = await response.blob();
      this.validateSource(sourcePhoto);
      return this.optimize(sourcePhoto);
    } catch (error: unknown) {
      if (this.wasCancelled(error)) return undefined;
      throw error;
    }
  }

  private validateSource(photo: Blob): void {
    if (photo.type && !photo.type.startsWith('image/')) throw new Error('Choose a valid image file.');
    if (photo.size > MAX_SOURCE_BYTES) throw new Error('Choose an image that is 5 MB or smaller.');
  }

  private async optimize(photo: Blob): Promise<string> {
    const url = URL.createObjectURL(photo);
    try {
      const image = await this.loadImage(url);
      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
      if (!sourceSize) throw new Error('The selected image has no usable pixels.');
      const outputSize = Math.min(TARGET_SIZE, sourceSize);
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Photo processing is unavailable on this device.');
      context.fillStyle = '#f2ede4';
      context.fillRect(0, 0, outputSize, outputSize);
      const sourceX = (image.naturalWidth - sourceSize) / 2;
      const sourceY = (image.naturalHeight - sourceSize) / 2;
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);

      let optimized = await this.canvasBlob(canvas, 0.58);
      if (optimized.size > MAX_STORED_BYTES) optimized = await this.canvasBlob(canvas, 0.42);
      if (optimized.size > MAX_STORED_BYTES) {
        const smaller = document.createElement('canvas');
        smaller.width = Math.min(320, outputSize);
        smaller.height = Math.min(320, outputSize);
        const smallerContext = smaller.getContext('2d');
        if (!smallerContext) throw new Error('Photo processing is unavailable on this device.');
        smallerContext.drawImage(canvas, 0, 0, smaller.width, smaller.height);
        optimized = await this.canvasBlob(smaller, 0.4);
      }
      return this.toDataUrl(optimized);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('This image format could not be opened.'));
      image.src = url;
    });
  }

  private canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('The photo could not be compressed.'))),
        'image/jpeg',
        quality,
      ),
    );
  }

  private toDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('Photo could not be read.'));
      reader.readAsDataURL(blob);
    });
  }

  private wasCancelled(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /cancel|canceled|cancelled|no image picked/i.test(message);
  }
}
