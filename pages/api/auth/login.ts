import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

interface Credential {
  id: string;
  username: string;
  password: string;
  role: string;
}

interface CredentialsData {
  credentials: Credential[];
  salt: string;
}

// Simple base64 decode function
function decodeCredential(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Read credentials file
    const credentialsPath = path.join(process.cwd(), 'admin-credentials.json');
    const credentialsData: CredentialsData = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

    // Find matching credential
    const matchingCredential = credentialsData.credentials.find(cred => {
      const decryptedUsername = decodeCredential(cred.username);
      const decryptedPassword = decodeCredential(cred.password);
      return decryptedUsername === username && decryptedPassword === password;
    });

    if (!matchingCredential) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Return user data (without password)
    const user = {
      id: matchingCredential.id,
      username: decodeCredential(matchingCredential.username),
      role: matchingCredential.role
    };

    res.status(200).json({ user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 