import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

const backendApi = axios.create({
  baseURL: 'http://app.sodmun.com/api'
});

// Helper for Soddy
export const askSoddy = async (messages: {role: string, content: string}[]) => {
  const response = await backendApi.post('/soddy', { messages });
  return response.data;
};