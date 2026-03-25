import axios from 'axios';
import { API_BASE } from '../config/api';

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await axios.get<{ status?: string }>(`${API_BASE}/health`, { timeout: 5000 });
    return res.data?.status === 'ok' || res.status === 200;
  } catch {
    return false;
  }
}
