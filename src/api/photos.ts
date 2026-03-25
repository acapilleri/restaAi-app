import client from './client';

export type PhotoEntry = {
  id: number;
  url: string;
  taken_on: string;
  weight_at_photo: number | null;
  ai_analysis: string | null;
};

export type PhotoComparisonItem = {
  id: number;
  url: string;
  taken_on: string;
  weight_at_photo: number | null;
};

export type PhotosResponse = {
  photos: PhotoEntry[];
  comparison: {
    first: PhotoComparisonItem;
    latest: PhotoComparisonItem;
    analysis: string;
  };
};

export function getPhotos(): Promise<PhotosResponse> {
  return client.get<PhotosResponse>('/photos').then((r) => r.data);
}

/** Body: FormData with 'photo' (file) and optional 'taken_on' (date string) */
export function uploadPhoto(formData: FormData): Promise<{ photo: PhotoEntry }> {
  return client
    .post<{ photo: PhotoEntry }>('/photos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
}

export function deletePhoto(id: number): Promise<{ message: string }> {
  return client.delete<{ message: string }>(`/photos/${id}`).then((r) => r.data);
}
