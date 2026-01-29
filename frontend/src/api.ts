const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const fetchData = async (endpoint: string) => {
 const response = await fetch(`${API_BASE_URL}${endpoint}`);
  if (!response.ok) throw new Error('Network response was not ok');
  return response.json();
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const submitData = async (endpoint: string, data: any) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      'content-type': 'application/json'
    }
  });
  return response.json();
};