import { Service } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Service()
export class PhotoService {
  async choose(): Promise<string | undefined> {
    return this.capture(CameraSource.Photos);
  }
  async take(): Promise<string | undefined> {
    return this.capture(CameraSource.Camera);
  }

  readBrowserFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('Photo could not be read.'));
      reader.readAsDataURL(file);
    });
  }

  private async capture(source: CameraSource): Promise<string | undefined> {
    const result = await Camera.getPhoto({
      source,
      resultType: CameraResultType.DataUrl,
      quality: 78,
      width: 720,
      height: 720,
      correctOrientation: true,
    });
    return result.dataUrl;
  }
}
