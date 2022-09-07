export default class CustomBot {
  public readonly id: string;
  public declare readonly token: string;
  public user: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
  } | null = null;
  constructor(id: string, token: string) {
    this.id = id;
    this.token = token;
  }

  public async getUser(force = false) {
    if (!this.user) return;
    const user = fetch("https://discord.com/api/v10/");
  }
}
