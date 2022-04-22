import { Collection } from "discord.js";
import Locale from "../structures/Locale";
import Exception, { Severity } from "../utils/Exception";
import CacheManager from "./CacheManager";
import fs from "fs";
import path from "path";
import Logger from "../utils/Logger";
import Constants from "../utils/Constants";
import en_US from "../locales/en_US/en_US.json";

export default class LocaleManager extends CacheManager<Locale> {
  private readonly defaultLocale: string;
  constructor(defaultLocale: string = Constants.DEFAULT_LOCALE) {
    super();
    this.defaultLocale = defaultLocale;
    this.initialize();
  }

  private async initialize(sync: boolean = true): Promise<void> {
    const _path = path.join(__dirname, "../locales");
    const files = (await this.readFolder(_path))?.filter((file) =>
      file.isDirectory()
    );
    Logger.info(
      `[${this.constructor.name}] I found ${files.length} files of Locels. Reading...`
    );
    for (const file of files) {
      const _files = (await this.readFolder(_path + "/" + file.name))?.filter(
        (_file) => _file.isFile() && path.extname(_file.name) === ".json"
      );
      if (_files.length <= 0)
        return Logger.warn(
          `[${this.constructor.name}] (${file.name}) Unable to find json file`
        );
      let locale: any = {};
      for (const _file of _files) {
        const data = await this.readFile(
          path.join(_path, `${file.name}/${_file.name}`)
        );
        locale = { ...locale, ...JSON.parse(data) };
      }
      this.add(file.name, locale);
    }
    if (sync) this.sync();
  }

  private readFile(_path: string): Promise<any> {
    return new Promise((resolve) => {
      fs.readFile(_path, "utf8", (err, data) => {
        if (err)
          throw new Exception(
            `[${this.constructor.name}] Unable to scan file: ${_path}`,
            Severity.FAULT,
            err as Error
          );
        resolve(data);
      });
    });
  }

  private readFolder(_path: string): Promise<Array<fs.Dirent>> {
    return new Promise((resolve) => {
      fs.readdir(_path, { withFileTypes: true }, (err, files) => {
        if (err)
          throw new Exception(
            `[${this.constructor.name}] Unable to scan folder: ${_path}`,
            Severity.FAULT,
            err
          );
        resolve(files);
      });
    });
  }

  sync(): void {
    const dlocale = this.cache.get(this.defaultLocale);
    if (!dlocale)
      throw new Exception(
        `[${this.constructor.name}] Unable to find primary locale(${this.defaultLocale}) to sync with other locales.`,
        Severity.FAULT
      );
    this.cache.forEach((locale) => {
      if (locale == dlocale) return;
      Logger.info(
        `[${this.constructor.name}] Synchronize ${dlocale.tag} primary locale with ${locale.tag} locale.`
      );
      this._sync(dlocale, locale);
    });
    Logger.info(
      `[${this.constructor.name}] All locales synced with primary locale(${dlocale.tag})`
    );
  }

  private _sync(_default: any, a: any, checkDefault: boolean = true): any {
    if (typeof _default !== "object") {
      if (checkDefault)
        throw new Exception(
          `[${this.constructor.name}] Default sync object not a object.`,
          Severity.SUSPICIOUS
        );
      return a ?? _default;
    }

    if (Array.isArray(_default)) {
      if (!Array.isArray(a)) return _default;

      const newArray: Array<any> = [];

      for (let i = 0; i < _default.length; i++) {
        if (!a[i]) {
          newArray.push(_default[i]);
        } else {
          newArray.push(this._sync(_default[i], a[i], false));
        }
      }

      return newArray;
    } else {
      if (Array.isArray(a)) return _default;

      const newObject: any = {};
      for (const [key, value] of Object.entries(_default)) {
        if (!a.hasOwnProperty(key)) {
          newObject[key] = _default[key];
        } else {
          newObject[key] = this._sync(value, a[key], false);
        }
      }

      return newObject;
    }
  }

  private add(folder: string, data: any): void {
    if (!("tags" in data) || !Array.isArray(data.tags))
      throw new Exception(
        `[${this.constructor.name}] Unable to find tags<> in file data. (tags are required!) [folder: ${folder}]`,
        Severity.SUSPICIOUS
      );
    const locale: Locale = new Locale({ ...en_US, ...data, folder: folder });
    this._add(locale);
  }

  public get(tag: string, required = false): Locale {
    const _get = this.cache.get(tag);
    if (!_get && required)
      throw new Exception(
        `An error occurred while fetching "${tag}" language content.`,
        Severity.SUSPICIOUS
      );
    const defaultLocale = this.cache.get(this.defaultLocale);
    if (!defaultLocale)
      throw new Exception(
        `An error occurred while fetching content for language`,
        Severity.FAULT,
        "This must not happen go check on it! [LocaleManager get()]"
      );
    return _get || defaultLocale;
  }
}
