import { v4 as uuidv4 } from "uuid";

export default class MessageBuilder {
  public readonly id: string;
  public content: string | null = null;
  public embeds: AppEmbed<"VIEW">[] = [];
  constructor(
    content: string | null,
    embeds: AppEmbed<"VIEW" | "CREATE">[],
    id?: string
  ) {
    this.id = id ?? uuidv4();
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

  public isSendable(): boolean {
    return true;
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
    id: string;
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
