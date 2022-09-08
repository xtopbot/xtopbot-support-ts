export default class CustomBot {
  public readonly id: string;
  public declare readonly token: string | null;
  public readonly username: string;
  public readonly discriminator: number;
  public readonly avatar: string;
  public readonly ownerId: string;
  public readonly tokenValidation: boolean;
  public readonly createdAt: Date;
  constructor(
    id: string,
    token: string,
    username: string,
    discriminator: number,
    avatar: string,
    ownerId: string,
    tokenValidation: boolean,
    createdAt: Date
  ) {
    this.id = id;
    this.token = token;
    this.username = username;
    this.discriminator = discriminator;
    this.avatar = avatar;
    this.ownerId = ownerId;
    this.tokenValidation = tokenValidation;
    this.createdAt = createdAt;
  }

  public getStatus(): CustomBotStatus {
    return !this.tokenValidation
      ? CustomBotStatus.TOKEN_INVALID
      : CustomBotStatus.ONLINE;
  }

  public async fetchUser() {
    const user = fetch("https://discord.com/api/v10/");
  }
}

export enum CustomBotStatus {
  ONLINE = 1,
  OFFLINE,
  TOKEN_INVALID,
}
