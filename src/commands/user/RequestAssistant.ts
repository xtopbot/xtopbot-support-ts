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
import Util, { Diff } from "../../utils/Util";
import { BaseCommand } from "../BaseCommand";
import { AnyInteraction, Method } from "../CommandMethod";
import Languages from "./Languages";
import CommandRequirementsHandler from "../RequirementHandler";
import moment from "moment";

export default class RequestAssistant extends BaseCommand {
  constructor() {
    super({
      flag: UserFlagsPolicy.NONE,
      memberPermissions: [],
      botPermissions: ["SendMessages", "EmbedLinks", "ManageChannels"],
      applicationCommandData: [
        {
          dmPermission: true,
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
        return d.matches("requestAssistant");
      },
    });
  }

  protected async buttonInteraction(dcm: Method<ButtonInteraction>) {
    if (dcm.getValue("requestAssistant", false) === "create")
      return this.request(
        null,
        dcm,
        (dcm.d.guild ??
          app.client.guilds.cache.get(Constants.supportServerId)) as Guild
      );
    if (dcm.getValue("requestAssistant", false) === "cancel") {
      const requestId = dcm.getValue("cancel", true);
      dcm.cf.formats.set("request.uuid", requestId);
      const request = await app.requests.fetch(requestId, false);
      if (!request || request.userId !== dcm.d.user.id)
        throw new Exception(
          dcm.locale.origin.plugins.requestHumanAssistant.failedCancelRequest,
          Severity.COMMON
        );
      await request.cancelRequest(dcm.locale.tag);
      return new Response(
        ResponseCodes.SUCCESS,
        {
          ...Util.addFieldToEmbed(
            dcm.locale.origin.plugins.requestHumanAssistant.requestCanceled
              .userRequested,
            0,
            "color",
            Constants.defaultColors.GREEN
          ),
          components: [],
          ephemeral: true,
        },
        Action.UPDATE
      );
    } else if (
      dcm.getValue("requestAssistant", false) === "accept" ||
      dcm.getValue("requestAssistant", false) === "close"
    ) {
      await dcm.d.deferReply({ ephemeral: true });

      if ((dcm.user.flags & Constants.StaffBitwise) === 0)
        throw new Exception(
          dcm.locale.origin.requirement.insufficientPermission,
          Severity.COMMON
        );
      const requestId = dcm.getValue("accept", true);
      dcm.cf.formats.set("request.uuid", requestId);
      const request = await app.requests.fetch(requestId, false);
      const requestStatus = await request?.getStatus(true);
      if (!request) {
        dcm.d.message.delete();
        throw new Exception(
          Util.quickFormatContext(
            dcm.locale.origin.plugins.requestHumanAssistant.noLongerExits,
            {
              "request.uuid.short": Util.getUUIDLowTime(requestId),
            }
          ),
          Severity.COMMON
        );
      }
      if (
        (requestStatus !== RequestAssistantStatus.SEARCHING &&
          requestStatus !== RequestAssistantStatus.ACTIVE) ||
        !request
      )
        dcm.d.message.delete();
      if (requestStatus !== RequestAssistantStatus.SEARCHING)
        throw new Exception(
          Util.quickFormatContext(
            dcm.locale.origin.plugins.requestHumanAssistant
              .mustBeOnSearchingStatusToBeAccepted,
            {
              "request.uuid.short": Util.getUUIDLowTime(requestId),
            }
          ),
          Severity.COMMON
        );
      if (request.userId === dcm.d.user.id)
        throw new Exception(
          Util.quickFormatContext(
            dcm.locale.origin.plugins.requestHumanAssistant
              .cannotAcceptByRequester,
            {
              "request.uuid.short": Util.getUUIDLowTime(requestId),
            }
          ),
          Severity.COMMON
        ); //
      const requester = (
        dcm.d.guild ?? app.client.guilds.cache.get(Constants.supportServerId)
      )?.members
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
          .cancelRequest(dcm.locale.tag)
          .catch((rejected) =>
            Logger.error(
              `Cancel Assistant Request Failed Message: ${rejected.message} (Accept Section)`
            )
          );
        throw new Exception(
          Util.quickFormatContext(
            dcm.locale.origin.plugins.requestHumanAssistant
              .requesterNotExistOnServer,
            {
              "request.uuid.short": Util.getUUIDLowTime(requestId),
            }
          ),
          Severity.COMMON
        );
      }
      const thread = await request.createThread(dcm.d.user);
      dcm.cf.formats.set("thread.id", thread.id);
      dcm.cf.formats.set("requester.id", request.userId);
      dcm.cf.formats.set("request.id", request.id);
      return new Response(ResponseCodes.SUCCESS, {
        ...Util.addFieldToEmbed(
          dcm.locale.origin.plugins.requestHumanAssistant
            .assistantAcceptsRequest.followUp,
          0,
          "color",
          Constants.defaultColors.GREEN
        ),
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Link,
                label:
                  dcm.locale.origin.plugins.requestHumanAssistant
                    .assistantAcceptsRequest.followUp.buttons[0],
                url: thread.url,
              },
            ],
          },
        ],
        ephemeral: true,
      });
    }
  }

  protected async selectMenuInteraction(dcm: Method<SelectMenuInteraction>) {
    if (dcm.getValue("requestAssistant", false) === "create") {
      if (dcm.getKey("setLocale")) {
        const res = await Languages.setLocale(
          dcm,
          dcm.d.values[0] as LocaleTag
        );
        if (res.code !== ResponseCodes.SUCCESS) return res;
        return this.request(
          null,
          dcm,
          (dcm.d.guild ??
            app.client.guilds.cache.get(Constants.supportServerId)) as Guild
        );
      }
    } else if (dcm.getValue("close", false)) {
      await dcm.d.deferReply({ ephemeral: true });

      if ((dcm.user.flags & Constants.StaffBitwise) === 0)
        throw new Exception(
          dcm.locale.origin.requirement.insufficientPermission,
          Severity.COMMON
        );
      const requestId = dcm.getValue("close", true);
      dcm.cf.formats.set("request.uuid", requestId);
      const request = await app.requests.fetch(requestId, false);
      const requestStatus = await request?.getStatus(true);
      if (!request) {
        dcm.d.message.delete();
        throw new Exception(
          Util.quickFormatContext(
            dcm.locale.origin.plugins.requestHumanAssistant.noLongerExits,
            {
              "request.uuid.short": Util.getUUIDLowTime(requestId),
            }
          ),
          Severity.COMMON
        );
      }
      if (
        requestStatus !== RequestAssistantStatus.ACTIVE &&
        requestStatus !== RequestAssistantStatus.CLOSED
      ) {
        dcm.d.message.delete();
        throw new Exception(
          Util.quickFormatContext(
            dcm.locale.origin.plugins.requestHumanAssistant
              .alreadyClosedWithReason,
            {
              "request.uuid.short": Util.getUUIDLowTime(requestId),
            }
          ),
          Severity.COMMON
        );
      }
      if (dcm.d.user.id !== request.assistantId)
        throw new Exception(
          Util.quickFormatContext(
            dcm.locale.origin.plugins.requestHumanAssistant
              .mustBeWhoAcceptTheAssistantRequestDoThisAction,
            {
              "request.uuid.short": Util.getUUIDLowTime(requestId),
              "request.assistant.id": request.assistantId ?? "",
            }
          ),
          Severity.COMMON
        );
      const reason =
        dcm.d.values[0] == "solved"
          ? RequestAssistantStatus.SOLVED
          : dcm.d.values[0] == "inactive"
          ? RequestAssistantStatus.REQUESTER_INACTIVE
          : null;
      if (!reason)
        throw new Exception("Selected value invalid", Severity.SUSPICIOUS);

      await request.closeThread(reason);
      dcm.cf.formats.set(
        "request.closed.period",
        String(
          moment(request.threadCreatedAt).locale(dcm.locale.tag).fromNow(true)
        )
      );
      dcm.cf.formats.set("request.userId", request.userId);
      return new Response(ResponseCodes.SUCCESS, {
        ...Util.addFieldToEmbed(
          dcm.locale.origin.plugins.requestHumanAssistant.threadClosed.admin,
          0,
          "color",
          Constants.defaultColors.GREEN
        ),
        ephemeral: true,
      });
    }
  }

  protected async modalSubmitInteraction(dcm: Method<ModalSubmitInteraction>) {
    if (dcm.getValue("requestAssistant", false) === "create") {
      return this.request(
        dcm.d.fields.getTextInputValue("issue"),
        dcm,
        (dcm.d.guild ??
          app.client.guilds.cache.get(Constants.supportServerId)) as Guild
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
    const guildAssistants = RequestHumanAssistantPlugin.getGuildAssistants(
      guild ?? app.client.guilds.cache.get(Constants.supportServerId)
    );

    const locale = app.locales.get(dcm.user.locale);
    if (!dcm.user.locale || !app.locales.get(dcm.user.locale ?? "", false))
      return new Response(
        ResponseCodes.REQUIRED_USER_LOCALE,
        {
          ...Util.addFieldToEmbed(
            locale.origin.plugins.pluginRequiredUserLocale,
            0,
            "color",
            Constants.defaultColors.BLUE
          ),
          components: Languages.getLocales(
            dcm,
            "requestAssistant:create:setLocale"
          ).message.components,
          ephemeral: true,
        },
        Action.REPLY
      ); // User must have lang
    await app.locales.checkUserRoles(
      dcm.user,
      guild ?? app.client.guilds.cache.get(Constants.supportServerId),
      dcm.d.member as GuildMember
    );
    if (!guildAssistants.role || !guildAssistants.channel)
      throw new Exception(
        locale.origin.plugins.serverNotMeetPluginCriteria,
        Severity.SUSPICIOUS
      );

    const userRequests = await app.requests.fetchUser(dcm.user);

    const activeRequest =
      userRequests.find(
        (request) =>
          request.getStatus(false) === RequestAssistantStatus.SEARCHING
      ) &&
      app.requests.cache.find(
        (request) =>
          request.getStatus(false) === RequestAssistantStatus.SEARCHING
      );

    if (activeRequest)
      return new Response(
        ResponseCodes.ACTIVE_ASSISTANT_REQUEST,
        {
          ...Util.addFieldToEmbed(
            locale.origin.plugins.requestHumanAssistant.activeRequest,
            0,
            "color",
            Constants.defaultColors.ORANGE
          ),
          ephemeral: true,
        },
        Action.REPLY
      );

    const activeThread = userRequests.find(
      (request) => request.getStatus(false) === RequestAssistantStatus.ACTIVE
    );
    if (
      activeThread &&
      (await activeThread.checkStatusThread()) === RequestAssistantStatus.ACTIVE
    ) {
      dcm.cf.formats.set("request.thread.id", activeThread.threadId as string);
      if (!dcm.member.roles.cache.get(guildAssistants.role.id))
        await dcm.member.roles.add(guildAssistants.role);
      const thread = await activeThread.getThread(false);
      const memberInThread = thread.members
        .fetch(dcm.d.user.id)
        .catch(() => null);
      if (!memberInThread) await thread.members.add(dcm.d.user);
      return new Response(
        ResponseCodes.THERE_ACTIVE_THREAD,
        {
          ...Util.addFieldToEmbed(
            locale.origin.plugins.requestHumanAssistant.activeThread,
            0,
            "color",
            Constants.defaultColors.ORANGE
          ),
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Link,
                  label:
                    locale.origin.plugins.requestHumanAssistant.activeThread
                      .buttons[0],
                  url: thread.url,
                },
              ],
            },
          ],
          ephemeral: true,
        },
        Action.REPLY
      );
    }

    const startDay = new Date().setUTCHours(0, 0, 0, 0);

    if (userRequests.length) {
      if (
        userRequests.filter(
          (userRequest) =>
            userRequest.getStatus(false) ===
              RequestAssistantStatus.REQUESTER_INACTIVE &&
            userRequest.requestedAt.getTime() > startDay
        ).length > 1 ||
        userRequests.filter(
          (userRequest) =>
            (userRequest.getStatus(false) === RequestAssistantStatus.CLOSED ||
              userRequest.getStatus(false) === RequestAssistantStatus.SOLVED ||
              userRequest.getStatus(false) ===
                RequestAssistantStatus.REQUESTER_INACTIVE) &&
            userRequest.requestedAt.getTime() > startDay
        ).length > 2 ||
        userRequests.filter(
          (userRequest) => userRequest.requestedAt.getTime() > startDay
        ).length > 2
      )
        throw new Exception(
          locale.origin.plugins.requestHumanAssistant.exceededLimitation,
          Severity.COMMON
        );
    }

    const assistant = guildAssistants.assistants.get(dcm.user.locale);
    if (!assistant)
      throw new Exception(
        locale.origin.plugins.requestHumanAssistant.unableToFindAssistantsForSpecificLanguage,
        Severity.COMMON
      );

    if (issue === null) return this.openModal(dcm);
    await dcm.d.deferReply({ ephemeral: true });

    const request = await app.requests.createRequest(
      issue,
      dcm.d.user,
      guild ?? app.client.guilds.cache.get(Constants.supportServerId),
      dcm.d.webhook,
      locale
    );
    request.setRequestTimeout();
    dcm.cf.formats.set("request.issue", request.issue);
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
        ...Util.addFieldToEmbed(
          locale.origin.plugins.requestHumanAssistant.requestCreated
            .interaction,
          0,
          "color",
          Constants.defaultColors.BLUE
        ),
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

  private openModal(dcm: Method<AnyInteraction>): Response<ModalResponse> {
    return new Response<ModalResponse>(
      ResponseCodes.PLUGIN_SUCCESS,
      {
        customId: "requestAssistant:create",
        title: dcm.locale.origin.plugins.requestHumanAssistant.modals[0].title,
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.TextInput,
                customId: "issue",
                label:
                  dcm.locale.origin.plugins.requestHumanAssistant.modals[0]
                    .textInput[0].label,
                placeholder:
                  dcm.locale.origin.plugins.requestHumanAssistant.modals[0]
                    .textInput[0].placeholder,
                required: true,
                minLength: 3,
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
