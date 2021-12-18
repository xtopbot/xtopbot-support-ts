import { Collection } from "discord.js";
import Locale from "../structures/Locale";
import Exception, { Severity } from "../utils/Exception";
import CacheManager from "./CacheManager";
import fs from "fs";
import path from "path";
import Logger from "../utils/Logger";
export default class LocaleManager extends CacheManager {
  private readonly defaultLocale: string;
  constructor(defaultLocale: string = "en_US") {
    super();
    this.defaultLocale = defaultLocale;
    this.initialize();
  }

  private initialize(): void {
    const _path = path.join(__dirname, "../locales");
    fs.readdir(_path, { withFileTypes: true }, (err, files) => {
      if (err)
        throw new Exception(
          "Unable to scan directory: " + _path,
          Severity.FAULT,
          err
        );
      for (const file of files) {
        if (!file.isDirectory()) return;
        fs.readdir(
          _path + "/" + file.name,
          { withFileTypes: true },
          (err, _files) => {
            if (err)
              throw new Exception(
                "Unable to scan directory: " + _path + "/" + file.name,
                Severity.FAULT,
                err
              );
            _files = _files.filter(
              (_file) => _file.isFile() && path.extname(_file.name) === ".json"
            );
            if (_files.length <= 0)
              return Logger.warn(
                `[${this.constructor.name}] (${file.name}) Unable to find json file`
              );
            let locale: any = {};
            for (const _file of _files) {
              try {
                const data = fs.readFileSync(
                  path.join(_path, `${file.name}/${_file.name}`),
                  "utf8"
                );
                locale = { ...locale, ...JSON.parse(data) };
              } catch (err) {
                throw new Exception(
                  `Unable to scan file: ${_path}/${file.name}/${_file.name}`,
                  Severity.FAULT,
                  err as Error
                );
              }
            }
            this.add(file.name, locale);
          }
        );
      }
    });
  }

  private sync(_default: any, a: any, checkDefault: boolean = true): any {
    if (typeof _default !== "object") {
      if (checkDefault)
        throw new Exception(
          "Default sync object not a object.",
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
          newArray.push(this.sync(_default[i], a[i], false));
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
          newObject[key] = this.sync(value, a[key], false);
        }
      }

      return newObject;
    }
  }

  private add(folder: string, data: any): void {
    if (!("tags" in data) || !Array.isArray(data.tags))
      throw new Exception(
        "Unable to find tags<> in file data. (tags are required!)",
        Severity.SUSPICIOUS
      );
    const locale: Locale = data;
    this._add(locale);
  }

  public get cache(): Collection<string, Locale> {
    return this._cache;
  }

  public get(tag: string): Locale {
    const _get = this.cache.get(tag);
    if (!_get)
      throw new Exception(
        `Unable to find \'${tag}\' in cached locale.`,
        Severity.SUSPICIOUS
      );
    return _get;
  }
}
