export interface AuthConfig {
  clientId: string;
  redirectUri: string;
}

export class GoogleAuth {
  private clientId: string;
  private redirectUri: string;

  constructor(config: AuthConfig) {
    this.clientId = config.clientId;
    this.redirectUri = config.redirectUri;
  }

  login() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce: this.generateNonce(),
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  getTokenFromUrl(): string | null {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return params.get('id_token');
  }

  clearToken() {
    window.location.hash = '';
  }

  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
