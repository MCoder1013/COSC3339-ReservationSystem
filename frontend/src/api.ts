const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const fetchData = async (endpoint: string) => {
 const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include' // Include cookies for authentication
  });
  if (!response.ok) throw new Error('Network response was not ok');
  return response.json();
};

export const submitData = async (endpoint: string, data: any) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    body: JSON.stringify(data),
    credentials: 'include', // Include cookies for authentication
    headers: {
      'content-type': 'application/json'
    }
  });
  return response.json();
};