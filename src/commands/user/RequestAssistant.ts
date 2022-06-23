import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  AutocompleteInteraction,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  DiscordAPIError,
  Guild,
  GuildMember,
  ModalSubmitInteraction,
  SelectMenuInteraction,
  TextInputStyle,
  ThreadChannel,
} from "discord.js";
import app from "../../app";
import { LocaleTag } from "../../managers/LocaleManager";
import RequestHumanAssistantPlugin from "../../plugins/RequestHumanAssistant";
import { RequestAssistantStatus } from "../../structures/RequestAssistant";
import { UserFlagsPolicy } from "../../structures/User";
import Exception, { Severity } from "../../utils/Exception";
import Response, {
  Action,
  MessageResponse,
  ModalResponse,
  ResponseCodes,
} from "../../utils/Response";
import { Diff } from "../../utils/Util";
import { BaseCommand } from "../BaseCommand";
import { AnyInteraction, Method } from "../CommandMethod";
import Languages from "./Languages";

export default class RequestAssistant extends BaseCommand {
  constructor() {
    super({
      flag: UserFlagsPolicy.NONE,
      memberPermissions: [],
      botPermissions: ["SendMessages", "EmbedLinks", "ManageChannels"],
      applicationCommandData: [
        {
          name: "request",
          description: "Requests an assistant to help you",
          type: ApplicationCommandType.ChatInput,
          options: [
            {
              name: "assistant",
              type: ApplicationCommandOptionType.Subcommand,
              description: "Requests an assistant to help you",
            },
          ],
        },
      ],
      messageComponent: (d) => {
        if (d.matches("requestAssistant")) {
          return true;
        }
        return false;
      },
    });
  }

  public async buttonInteraction(dcm: Method<ButtonInteraction>) {
    if (dcm.getValue("requestAssistant", false) === "create")
      return this.request(null, dcm, dcm.d.guild as Guild);
  }

  public async selectMenuInteraction(dcm: Method<SelectMenuInteraction>) {
    if (dcm.getValue("requestAssistant", false) === "create") {
      if (dcm.getKey("setLocale")) {
        const res = await Languages.setLocale(
          dcm,
          dcm.d.values[0] as LocaleTag
        );
        if (res.code !== ResponseCodes.SUCCESS) return res;
        return this.request(null, dcm, dcm.d.guild as Guild);
      }
    }
  }

  public async modalSubmitInteraction(dcm: Method<ModalSubmitInteraction>) {
    if (dcm.getValue("requestAssistant", false) === "create") {
      return this.request(
        dcm.d.fields.getTextInputValue("issue"),
        dcm,
        dcm.d.guild as Guild
      );
    }
  }

  private async request(
    issue: null,
    dcm: Method<Diff<AnyInteraction, AutocompleteInteraction>>,
    guild: Guild
  ): Promise<Response<MessageResponse | ModalResponse>>;
  private async request(
    issue: string,
    dcm: Method<Diff<AnyInteraction, AutocompleteInteraction>>,
    guild: Guild
  ): Promise<Response<MessageResponse>>;
  private async request(
    issue: string | null,
    dcm: Method<Diff<AnyInteraction, AutocompleteInteraction>>,
    guild: Guild
  ): Promise<Response<MessageResponse | ModalResponse>> {
    const guildAssistants =
      RequestHumanAssistantPlugin.getGuildAssistants(guild);

    const locale = app.locales.get(dcm.user.locale);
    if (!dcm.user.locale || !app.locales.get(dcm.user.locale ?? "", false))
      return new Response(
        ResponseCodes.REQUIRED_USER_LOCALE,
        {
          ...locale.origin.plugins.pluginRequiredUserLocale,
          components: app.locales.getMessageWithMenuOfLocales(
            dcm.user,
            "helpdesk:requestAssistant:setLocale"
          ).components,
          ephemeral: true,
        },
        Action.REPLY
      ); // User must have lang
    await app.locales.checkUserRoles(
      dcm.user,
      guild,
      dcm.d.member as GuildMember
    );
    if (!guildAssistants.role || !guildAssistants.channel)
      return new Response(
        ResponseCodes.SERVER_NOT_MEET_PLUGIN_CRITERIA,
        {
          ...locale.origin.plugins.serverNotMeetPluginCriteria,
          ephemeral: true,
        },
        Action.REPLY
      );

    const userRequests = await app.requests.fetchUser(dcm.user);

    const activeRequest =
      userRequests.find(
        (request) =>
          request.userId == dcm.user.id &&
          request.status === RequestAssistantStatus.SEARCHING
      ) &&
      app.requests.cache.find(
        (request) =>
          request.userId == dcm.user.id &&
          request.status === RequestAssistantStatus.SEARCHING
      );

    if (activeRequest)
      return new Response(
        ResponseCodes.ACTIVE_ASSISTANT_REQUEST,
        {
          ...locale.origin.plugins.requestHumanAssistant.activeRequset,
          ephemeral: true,
        },
        Action.REPLY
      );

    const activeThread = userRequests.find(
      (request) =>
        request.userId == dcm.user.id &&
        request.status === RequestAssistantStatus.ACTIVE
    );
    if (activeThread) {
      const thread = ((await activeThread.getThread(true).catch((err) => {
        if (err instanceof DiscordAPIError && err.code == 500)
          throw new Exception(
            "Something was wrong with discord API",
            Severity.FAULT,
            err
          );
      })) ?? null) as ThreadChannel | null;
      if (thread) {
        if (thread.archived === false) {
          dcm.cf.formats.set("thread.id", thread.id);
          if (!dcm.member.roles.cache.get(guildAssistants.role.id))
            await dcm.member.roles.add(guildAssistants.role);
          return new Response(
            ResponseCodes.THERE_ACTIVE_THREAD,
            {
              ...locale.origin.plugins.requestHumanAssistant.activeThread,
              ephemeral: true,
            },
            Action.REPLY
          );
        }
      }
    }

    const startDay = new Date().setUTCHours(0, 0, 0, 0);

    if (userRequests.length) {
      if (
        userRequests.find(
          (userRequest) =>
            userRequest.threadCreatedAt &&
            userRequest.requestedAt.getTime() >=
              userRequest.threadCreatedAt.getTime() - 120 * 1000 &&
            userRequest.requestedAt.getTime() >= Date.now() - 60 * 60 * 1000 &&
            userRequest.status !=
              RequestAssistantStatus.SOLVED /*He closed the thread in less than two minutes (He should wait an hour to request an assistant again)*/
        ) ||
        userRequests.filter(
          (userRequest) => userRequest.requestedAt.getTime() > startDay
        ).length > 2
      )
        return new Response(
          ResponseCodes.EXCEEDED_LIMIT_FOR_REQUEST_ASSISTANT,
          {
            ...locale.origin.plugins.requestHumanAssistant.exceededlimitation,
            ephemeral: true,
          },
          Action.REPLY
        );
    }

    const assistant = guildAssistants.assistants.get(dcm.user.locale);
    if (!assistant)
      return new Response(
        ResponseCodes.LOCALE_ASSISTANT_NOT_FOUND,
        {
          content: "Unable to find Assistant for your lang",
          ephemeral: true,
        },
        Action.REPLY
      );

    if (issue === null) return this.openModal();

    const request = await app.requests.createRequest(
      issue,
      dcm.d.user.id,
      guild.id,
      dcm.d.webhook,
      locale.tag
    );
    dcm.cf.formats.set("request.id", request.id);
    dcm.cf.formats.set(
      "request.timestamp",
      String(Math.round(request.requestedAt.getTime() / 1000))
    );
    dcm.cf.formats.set("locale.name", locale.origin.name);
    return new Response(
      ResponseCodes.SUCCESS,
      {
        ...locale.origin.plugins.requestHumanAssistant.requestCreated,
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                customId: `requestAssistant:cancel:${request.id}`,
                style: ButtonStyle.Danger,
                label:
                  locale.origin.plugins.requestHumanAssistant.requestCreated
                    .buttons[0],
              },
            ],
          },
        ],
        ephemeral: true,
      },
      Action.REPLY
    );
  }

  private openModal(): Response<ModalResponse> {
    return new Response<ModalResponse>(
      ResponseCodes.PLUGIN_SUCCESS,
      {
        customId: "requestAssistant:create",
        title: "Request Assistant",
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.TextInput,
                customId: "issue",
                label: "issue",
                required: true,
                minLength: 5,
                maxLength: 100,
                style: TextInputStyle.Paragraph,
              },
            ],
          } /*
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.SelectMenu,
                customId: "language",
                disabled: true,
                required: true,

                maxValues: 1,
                minValues: 0,
                placeholder: "Select language you might understand",
                options: [
                  {
                    label: "English",
                    value: "english",
                    emoji: {
                      name: "🇺🇸",
                    },
                  },
                  {
                    label: "عربي",
                    value: "arabic",
                    emoji: {
                      name: "🇸🇦",
                    },
                  },
                ],
              } as any,
            ],
          },*/,
        ],
      },
      Action.MODAL
    );
  }
}
