import { v4 as uuidv4 } from "uuid";
import db from "../providers/Mysql";
import app from "../app";
import Exception, { Severity } from "../utils/Exception";

export default class MessageBuilder {
  public readonly id: string;
  public content: string | null = null;
  public embeds: AppEmbed<"VIEW">[] = [];
  public createdAt: Date = new Date();
  public updatedAt: Date = new Date();

  constructor(
    content: string | null,
    embeds: AppEmbed<"VIEW" | "CREATE">[],
    options?: { id: string; createdAt: Date; updatedAt: Date }
  ) {
    this.id = options?.id ?? uuidv4();
    this.createdAt = options?.createdAt ?? this.createdAt;
    this.updatedAt = options?.updatedAt ?? this.updatedAt;
    this.embeds.map((embed) => embed.author?.url);
    this._patch({ content, embeds });
  }

  public _patch(data: {
    content: string | null;
    embeds: AppEmbed<"VIEW" | "CREATE" | "EDIT">[];
  }) {
    this.content = typeof data.content === "string" ? data.content : null;

    this.embeds = data.embeds.map((embed) => ({
      id: embed.id ?? uuidv4(),
      title: typeof embed.title === "string" ? embed.title : null,
      description:
        typeof embed.description === "string" ? embed.description : null,
      url: typeof embed.url === "string" ? embed.url : null,
      timestamp: typeof embed.timestamp === "number" ? embed.timestamp : null,
      color: typeof embed.color === "number" ? embed.color : null,
      author:
        typeof embed.author?.name !== "undefined" ||
        typeof embed.author?.url !== "undefined" ||
        typeof embed.author?.icon_url !== "undefined"
          ? {
              name:
                typeof embed.author.name === "string"
                  ? embed.author.name
                  : null,
              url:
                typeof embed.author.url === "string" ? embed.author.url : null,
              icon_url:
                typeof embed.author.icon_url === "string"
                  ? embed.author.icon_url
                  : null,
            }
          : null,
      footer:
        typeof embed.footer?.text !== "undefined" ||
        typeof embed.footer?.icon_url !== "undefined"
          ? {
              text:
                typeof embed.footer.text === "string"
                  ? embed.footer.text
                  : null,
              icon_url:
                typeof embed.footer.icon_url === "string"
                  ? embed.footer.icon_url
                  : null,
            }
          : null,
      image:
        typeof embed.image?.url !== "undefined" ||
        typeof embed.image?.height !== "undefined" ||
        typeof embed.image?.width !== "undefined"
          ? {
              url: typeof embed.image.url === "string" ? embed.image.url : null,
              height:
                typeof embed.image.height === "number"
                  ? embed.image.height
                  : null,
              width:
                typeof embed.image.width === "number"
                  ? embed.image.width
                  : null,
            }
          : null,
      thumbnail:
        typeof embed.thumbnail?.url !== "undefined" ||
        typeof embed.thumbnail?.height !== "undefined" ||
        typeof embed.thumbnail?.width !== "undefined"
          ? {
              url:
                typeof embed.thumbnail.url === "string"
                  ? embed.thumbnail.url
                  : null,
              height:
                typeof embed.thumbnail.height === "number"
                  ? embed.thumbnail.height
                  : null,
              width:
                typeof embed.thumbnail.width === "number"
                  ? embed.thumbnail.width
                  : null,
            }
          : null,
      fields:
        embed.fields
          ?.filter(
            (field) =>
              typeof field?.name !== "undefined" ||
              typeof field?.value !== "undefined" ||
              typeof field?.inline !== "undefined"
          )
          .map((field: any) => ({
            id: field?.id ?? uuidv4(),
            name: typeof field?.name === "string" ? field.name : null,
            value: typeof field?.value === "string" ? field.value : null,
            inline: typeof field?.inline === "boolean" ? field.inline : null,
          })) ?? [],
    }));
  }

  public async fetch() {
    const messageBuilder = await app.messages.fetch(this.id, true);
    if (!messageBuilder)
      throw new Exception(
        "Article Message no longer exists!",
        Severity.SUSPICIOUS
      );
    return app.messages.fetch(this.id, true);
  }

  public async edit(
    content: string | null,
    embeds?: AppEmbed<"EDIT">[]
  ): Promise<this> {
    this._patch({ content, embeds: embeds ?? [] });

    await db.query(`update \`Message\` set content = ? where BIN_TO_UUID(?)`, [
      content,
      this.id,
    ]);

    /**
     * When Message updated old embeds will be deleted. if want to add embeds just need to check if there embed to add or not.
     */
    if (embeds && embeds.length > 1) await this.addEmbeds(embeds);

    return this;
  }

  public async addEmbeds(embeds: AppEmbed<"CREATE" | "EDIT">[]) {
    await db.query(
      `insert into \`Message.Embed\` (id, messageId, title, description, url, timestamp, color) values ${embeds.map(
        (_embed) => `(UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?, ?, ?)`
      )}`,
      this.embeds
        .map((embed) => [
          embed.id,
          this.id,
          embed.title,
          embed.description,
          embed.url,
          embed.timestamp,
          embed.color,
        ])
        .flat()
    );
    const authorData = this.embeds
      .filter((embed) => embed.author !== null)
      .map((embed) => [
        embed.id,
        embed.author?.name ?? null,
        embed.author?.url ?? null,
        embed.author?.icon_url ?? null,
      ])
      .flat();
    if (authorData.length)
      await db.query(
        `insert into \`Message.Embed.Author\` (embedId, name, url, icon_url) values ${authorData.map(
          (_embed) => `(UUID_TO_BIN(?), ?, ?, ?)`
        )}`,
        authorData
      );

    const footerData = this.embeds
      .filter((embed) => embed.footer !== null)
      .map((embed) => [
        embed.id,
        embed.footer?.text ?? null,
        embed.footer?.icon_url ?? null,
      ])
      .flat();
    if (footerData.length)
      await db.query(
        `insert into \`Message.Embed.Footer\` (embedId, text, icon_url) values ${footerData.map(
          (_embed) => `(UUID_TO_BIN(?), ?, ?)`
        )}`,
        footerData
      );

    const thumbnailData = this.embeds
      .filter((embed) => embed.thumbnail !== null)
      .map((embed) => [
        embed.id,
        embed.thumbnail?.url ?? null,
        embed.thumbnail?.height ?? null,
        embed.thumbnail?.width ?? null,
      ])
      .flat();
    if (thumbnailData.length)
      await db.query(
        `insert into \`Message.Embed.Thumbnail\` (embedId, url, height, width) values ${thumbnailData.map(
          (_embed) => `(UUID_TO_BIN(?), ?, ?, ?)`
        )}`,
        thumbnailData
      );

    const imageData = this.embeds
      .filter((embed) => embed.image !== null)
      .map((embed) => [
        embed.id,
        embed.image?.url ?? null,
        embed.image?.height ?? null,
        embed.image?.width ?? null,
      ])
      .flat();
    if (imageData.length)
      await db.query(
        `insert into \`Message.Embed.Image\` (embedId, url, height, width) values ${imageData.map(
          (_embed) => `(UUID_TO_BIN(?), ?, ?, ?)`
        )}`,
        imageData
      );

    const fieldsData = this.embeds
      .map((embed) =>
        embed.fields.map((field) => [
          embed.id,
          field.name,
          field.value,
          field.inline,
        ])
      )
      .flat(2);
    if (fieldsData.length)
      await db.query(
        `insert into \`Message.Embed.Fields\` (embedId, name, value, inline) values ${fieldsData.map(
          (_embed) => `(UUID_TO_BIN(?), ?, ?, ?)`
        )}`,
        fieldsData
      );
  }

  public isSendable(): boolean {
    let sendable = false;
    if (typeof this.content === "string") sendable = true;

    this.embeds.map((embed) => {
      if (typeof embed.title === "string" || embed.description === "string")
        sendable = true;

      if (embed.author?.name === null && typeof embed.author.url === "string")
        sendable = false;
      if (
        embed.footer?.text === null &&
        typeof embed.footer.icon_url === "string"
      )
        sendable = false;

      embed.fields.map((field) => {
        if (
          typeof field.name !== "string" ||
          field.name.length < 1 ||
          field.name === "\n"
        )
          sendable = false;
      });
    });
    return sendable;
  }
}

export type AppEmbed<T extends "VIEW" | "EDIT" | "CREATE"> = T extends "CREATE"
  ? Partial<AppEmbedType<T>>
  : AppEmbedType<T>;

type AppEmbedType<T extends "VIEW" | "EDIT" | "CREATE"> = {
  id: string;
  title: TypeAppEmbedField<T, string>;
  description: TypeAppEmbedField<T, string>;
  timestamp: TypeAppEmbedField<T, number>;
  color: TypeAppEmbedField<T, number>;
  url: TypeAppEmbedField<T, string>;
  author: TypeAppEmbedField<
    T,
    {
      name: TypeAppEmbedField<T, string>;
      url: TypeAppEmbedField<T, string>;
      icon_url: TypeAppEmbedField<T, string>;
    }
  >;
  footer: TypeAppEmbedField<
    T,
    {
      text: TypeAppEmbedField<T, string>;
      icon_url: TypeAppEmbedField<T, string>;
    }
  >;
  image: TypeAppEmbedField<
    T,
    {
      url: TypeAppEmbedField<T, string>;
      height: TypeAppEmbedField<T, number>;
      width: TypeAppEmbedField<T, number>;
    }
  >;
  thumbnail: TypeAppEmbedField<
    T,
    {
      url: TypeAppEmbedField<T, string>;
      height: TypeAppEmbedField<T, number>;
      width: TypeAppEmbedField<T, number>;
    }
  >;
  fields: {
    name: TypeAppEmbedField<T, string>;
    value: TypeAppEmbedField<T, string>;
    inline: TypeAppEmbedField<T, boolean>;
  }[];
};

type TypeAppEmbedField<
  T extends "VIEW" | "EDIT" | "CREATE",
  A
> = T extends "VIEW"
  ? A | null
  : T extends "EDIT"
  ? A | null
  : T extends "CREATE"
  ? A | null
  : never;

const test: AppEmbed<"CREATE"> = {
  title: "test",
};
