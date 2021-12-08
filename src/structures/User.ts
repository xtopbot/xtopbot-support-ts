import { Client, User } from "discord.js";
import { RawUserData } from "discord.js/typings/rawDataTypes";

export default class UserApp extends User {
  private _appSynced: boolean = false;
  constructor(client: Client, data: RawUserData) {
    super(client, data);
  }

  public get appSynced(): boolean {
    return this._appSynced;
  }
}

export enum UserLevelPolicy {
  BLOCKED,
  USER,
  PREMIUM,
  SUPPORT,
  STAFF,
  ADMIN,
  DEVELOPER,
}
