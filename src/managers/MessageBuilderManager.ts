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
    select BIN_TO_UUID(m.id) as id, m.content, unix_timestamp(m.createdAt) as createdTimestampAt, unix_timestamp(m.updatedAt) as updatedTimestampAt, me.id as embedId, me.title, me.description, me.timestamp, me.url, mea.name as authorName, mea.url as authorUrl, mea.icon_url as authorIconUrl, met.url as thumbnailUrl, met.height as thumbnailHeight, met.width as thumbnailWidth, mef.text as footerText, mef.icon_url as footerIconUrl, mei.url as imageUrl, mei.height as imageHeight, mei.width as imageWidth, mefs.name as fieldName, mefs.value as fieldValue, mefs.inline as fieldInline
    from \`Message\` m
    left join \`Message.Embed\` me on me.messageId = m.id
    left join \`Message.Embed.Author\` mea on mea.embedId = me.id
    left join \`Message.Embed.Thumbnail\` met on met.embedId = me.id
    left join \`Message.Embed.Footer\` mef on mef.embedId = me.id
    left join \`Message.Embed.Image\` mei on mei.embedId = me.id
    left join \`Message.Embed.Fields\` mefs on mefs.embedId = me.id
    ${fetchSingleMessage ? "where BIN_TO_UUID(m.id) = ?;" : ""}
    `,
        [id]
      )
    );

    const messages = resolved.map(
      (r) =>
        new MessageBuilder(r.content, r.embeds, {
          id: r.id,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })
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
    embeds?: AppEmbed<"CREATE">[]
  ): Promise<MessageBuilder> {
    const messageBuilder = new MessageBuilder(content ?? null, embeds ?? []);

    await db.query(
      `insert into \`Message\` (id, content) values (UUID_TO_BIN(?), ?)`,
      [messageBuilder.id, content ?? null]
    );

    if (embeds && embeds.length > 1) await messageBuilder.addEmbeds(embeds);

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
        updatedAt: new Date(Math.round(message.updatedTimestampAt * 1000)),
        createdAt: new Date(Math.round(message.createdTimestampAt * 1000)),
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
            fields: raws?.map((field) => ({
              name: field.fieldName,
              value: field.fieldValue ?? null,
              inline: field.fieldInline ?? null,
            })),
          })),
      }));
  }
}
