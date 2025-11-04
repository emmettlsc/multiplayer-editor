import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
  cache: true,
  cacheMaxAge: 3600000, // 1 hour
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

// originally imported TokenPayload from google-auth-library but this is simpler
export interface GoogleTokenPayload {
  email: string; // emmettlsc@gmail.com
  email_verified: boolean;
  name: string; // user's full name
  picture: string; // URL of the user's profile picture
  iss: string;  //issuer identifier = accounts.google.com
  aud: string; //audience = OAuth 2.0 client ID
  sub: string; // unique identifier for the user
}

export function verifyGoogleToken(token: string): Promise<GoogleTokenPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ['RS256'],
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
      },
      (err, decoded) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(decoded as GoogleTokenPayload);
      }
    );
  });
}

// for testing
const ALLOWED_EMAILS = new Set([
  'emmettlsc@gmail.com',
]);

export function isUserAllowed(email: string): boolean {
  return true; //ALLOWED_EMAILS.has(email);
}
