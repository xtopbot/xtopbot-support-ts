import db from "../providers/Mysql";
import CacheManager from "./CacheManager";
import MessageBuilder, { AppEmbed } from "../structures/MessageBuilder";

export default class MessageBuilderManager extends CacheManager<MessageBuilder> {
  constructor() {
    super();
  }

  public async fetch(): Promise<MessageBuilder[]>;
  public async fetch(
    id: string,
    force: boolean
  ): Promise<MessageBuilder | null>;
  public async fetch(
    id?: string,
    force?: boolean
  ): Promise<MessageBuilder[] | MessageBuilder | null> {
    const fetchSingleMessage = !!id;

    if (fetchSingleMessage && !force) {
      const cachedMessage = this.cache.get(id);
      if (cachedMessage) return cachedMessage;
    }

    const resolved = this.resolve(
      await db.query(
        `
    select BIN_TO_UUID(m.id) as id, m.content, unix_timestamp(m.createdAt) as createdTimestampAt, unix_timestamp(m.updatedAt) as updatedTimestampAt, me.id as embedId, me.title, me.description, me.timestamp, me.url, mea.name as authorName, mea.url as authorUrl, mea.icon_url as authorIconUrl, met.url as thumbnailUrl, met.height as thumbnailHeight, met.width as thumbnailWidth, mef.text as footerText, mef.icon_url as footerIconUrl, mei.url as imageUrl, mei.height as imageHeight, mei.width as imageWidth, mefs.id as fieldId, mefs.name as fieldName, mefs.value as fieldValue, mefs.inline as fieldInline
    from \`Message\` m
    left join \`Message.Embed\` me on me.messageId = m.id
    left join \`Message.Embed.Author\` mea on mea.embedId = me.id
    left join \`Message.Embed.Thumbnail\` met on met.embedId = me.id
    left join \`Message.Embed.Footer\` mef on mef.embedId = me.id
    left join \`Message.Embed.Image\` mei on mei.embedId = me.id
    left join \`Message.Embed.Fields\` mefs on mefs.embedId = me.id
    ${fetchSingleMessage ? "where m.id = UUID_TO_BIN(?);" : ""}
    `,
        [id]
      )
    );

    const messages = resolved.map(
      (r) => new MessageBuilder(r.content, r.embeds, r.id)
    );

    if (fetchSingleMessage) {
      if (!messages.length) return null;
      return this._add(messages[0]);
    }
    messages.map((m) => this._add(m));
    return messages;
  }

  public async create(
    content: string | null,
    embeds: AppEmbed<"CREATE">[]
  ): Promise<MessageBuilder> {
    const messageBuilder = new MessageBuilder(content ?? null, embeds);
    await db.query(
      `insert into \`Message\` (id, content) values (UUID_TO_BIN(?), ?)`,
      [messageBuilder.id, content ?? null]
    );
    if (embeds.length) {
      await db.query(
        `insert into \`Message.Embed\` (id, messageId, title, description, url, timestamp, color) values ${embeds.map(
          (_embed) => `(UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?, ?, ?)`
        )}`,
        messageBuilder.embeds
          .map((embed) => [
            embed.id,
            messageBuilder.id,
            embed.title,
            embed.description,
            embed.url,
            embed.timestamp,
            embed.color,
          ])
          .flat()
      );
      const authorData = messageBuilder.embeds
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

      const footerData = messageBuilder.embeds
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

      const thumbnailData = messageBuilder.embeds
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

      const imageData = messageBuilder.embeds
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

      const fieldsData = messageBuilder.embeds
        .map((embed) =>
          embed.fields.map((field) => [
            embed.id,
            field.id,
            field.name,
            field.value,
            field.inline,
          ])
        )
        .flat(2);
      if (fieldsData.length)
        await db.query(
          `insert into \`Message.Embed.Fields\` (embedId, id, name, value, inline) values ${messageBuilder.embeds.map(
            (_embed) => `(UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?)`
          )}`,
          fieldsData
        );
    }

    return messageBuilder;
  }

  private resolve(raws: any[]) {
    return raws
      ?.filter(
        (raw, index) =>
          raws.map((raw) => raw.id).indexOf(raw.id) === index && raw.id
      )
      .map((message) => ({
        id: message.id,
        content: message.content,
        updatedAt: Math.round(message.updatedTimestampAt * 1000),
        createdAt: Math.round(message.createdTimestampAt * 1000),
        embeds: raws
          ?.filter(
            (embed, index) =>
              raws.map((raw) => raw.embedId).indexOf(embed.embedId) === index
          )
          .map((embed) => ({
            id: embed.embedId,
            title: embed.title ?? null,
            description: embed.description ?? null,
            timestamp:
              typeof embed.timestamp === "number" ? embed.timestamp : null,
            color: typeof embed.color === "number" ? embed.color : null,
            url: embed.url ?? null,
            author: {
              name: embed.authorName ?? null,
              url: embed.authorUrl ?? null,
              icon_url: embed.authorIconUrl ?? null,
            },
            thumbnail: {
              url: embed.thumbnailUrl ?? null,
              height:
                typeof embed.thumbnailHeight === "number"
                  ? embed.thumbnailHeight
                  : null,
              width:
                typeof embed.thumbnailWidth === "number"
                  ? embed.thumbnailWidth
                  : null,
            },
            footer: {
              text: embed.footerText ?? null,
              icon_url: embed.footerIconUrl ?? null,
            },
            image: {
              url: embed.imageUrl ?? null,
              height:
                typeof embed.imageHeight === "number"
                  ? embed.imageHeight
                  : null,
              width:
                typeof embed.imageWidth === "number" ? embed.imageWidth : null,
            },
            fields: raws
              ?.filter(
                (raw, index) =>
                  raws.map((raw) => raw.fieldId).indexOf(raw.fieldId) === index
              )
              .map((field) => ({
                id: field.fieldId,
                name: field.fieldName,
                value: field.fieldValue ?? null,
                inline: field.fieldInline ?? null,
              })),
          })),
      }));
  }
}
