import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  AutocompleteInteraction,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  DiscordAPIError,
  DiscordjsErrorCodes,
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
import Constants from "../../utils/Constants";
import Exception, { Severity } from "../../utils/Exception";
import Logger from "../../utils/Logger";
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
    if (dcm.getValue("requestAssistant", false) === "cancel") {
      const requestId = dcm.getValue("cancel", true);
      dcm.cf.formats.set("request.uuid", requestId);
      const request = await app.requests.fetch(requestId, false);
      if (
        !request ||
        request.status !== RequestAssistantStatus.SEARCHING ||
        request.userId !== dcm.d.user.id
      )
        return new Response<MessageResponse>(
          ResponseCodes.FAILED_TO_CANCEL_ASSISTANT_REQUEST,
          {
            content:
              "Failed to cancel your `{{request.uuid}}` Assistant Request.",
            ephemeral: true,
          }
        );
      await request.cancelRequest();
      return new Response(
        ResponseCodes.SUCCESS,
        {
          ...dcm.locale.origin.plugins.requestHumanAssistant.requestCanceled
            .userRequested,
          components: [],
          ephemeral: true,
        },
        Action.UPDATE
      );
    } else if (dcm.getValue("requestAssistant", false) === "accept") {
      if ((dcm.user.flags & Constants.StaffBitwise) === 0)
        return new Response<MessageResponse>(
          ResponseCodes.INSUFFICIENT_PERMISSION,
          {
            ...dcm.locale.origin.requirement.insufficientPermission,
            ephemeral: true,
          }
        );
      const requestId = dcm.getValue("accept", true);
      dcm.cf.formats.set("request.uuid", requestId);
      const request = await app.requests.fetch(requestId, false);
      if (
        request?.status !== RequestAssistantStatus.SEARCHING &&
        request?.status !== RequestAssistantStatus.ACTIVE
      )
        dcm.d.message.delete();
      if (
        !request ||
        request.status !== RequestAssistantStatus.SEARCHING ||
        request.userId === dcm.d.user.id
      )
        return new Response<MessageResponse>(
          ResponseCodes.FAILED_TO_ACCEPT_ASSISTANT_REQUEST,
          {
            content: "Failed to Accept `{{request.uuid}}` Assistant Request.",
            ephemeral: true,
          }
        );
      const requester = dcm.d.guild?.members
        .fetch({ user: request.userId, force: true })
        .catch((rejected) => {
          if (
            rejected instanceof DiscordAPIError &&
            (rejected.code === 10007 || rejected.code === 10013)
          )
            return null;
          throw new Exception(
            "Something was wrong with Discord API",
            Severity.SUSPICIOUS
          );
        });
      if (!requester) {
        await request
          .cancelRequest()
          .catch((rejected) =>
            Logger.error(
              `Cancel Assistant Request Failed Message: ${rejected.message} (Accept Section)`
            )
          );
        return new Response<MessageResponse>(
          ResponseCodes.REQUSTER_NOT_ON_SERVER_REQUEST_CANCELED,
          {
            content:
              "The Requester is not currently on the server, the assistant request has been canceled",
            ephemeral: true,
          }
        );
      }
      const thread = await request.createThread(dcm.d.user.id);
      dcm.cf.formats.set("thread.id", thread.id);
      return new Response(ResponseCodes.SUCCESS, {
        ...dcm.locale.origin.plugins.requestHumanAssistant
          .assistantAcceptsRequest.followUp,
        ephemeral: true,
      });
    }
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
            "requestAssistant:create:setLocale"
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
    console.log(userRequests);
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
        userRequests.filter(
          (userRequest) =>
            userRequest.threadCreatedAt &&
            userRequest.requestedAt.getTime() >=
              userRequest.threadCreatedAt.getTime() - 120 * 1000 &&
            userRequest.requestedAt.getTime() >= Date.now() - 60 * 60 * 1000 &&
            userRequest.status != RequestAssistantStatus.SOLVED
        ).length > 0 ||
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
      dcm.d.user,
      guild,
      dcm.d.webhook,
      locale
    );
    request.setRequestTimeout();
    dcm.cf.formats.set("request.uuid", request.id);
    dcm.cf.formats.set(
      "request.timestamp",
      String(Math.round(request.requestedAt.getTime() / 1000))
    );
    dcm.cf.formats.set(
      "request.expires.in.minutes",
      String(Constants.DEFAULT_INTERACTION_EXPIRES / 1000 / 60)
    );
    dcm.cf.formats.set(
      "request.expires.timestamp",
      String(
        Math.round(
          request.requestedAt.getTime() +
            Constants.DEFAULT_INTERACTION_EXPIRES / 1000
        )
      )
    );
    dcm.cf.formats.set("locale.name", locale.origin.name);
    return new Response(
      ResponseCodes.SUCCESS,
      {
        ...locale.origin.plugins.requestHumanAssistant.requestCreated
          .interaction,
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                customId: `requestAssistant:cancel:${request.id}`,
                style: ButtonStyle.Secondary,
                label:
                  locale.origin.plugins.requestHumanAssistant.requestCreated
                    .interaction.buttons[0],
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
