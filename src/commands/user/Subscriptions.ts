import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  InteractionType,
  ModalSubmitInteraction,
  SelectMenuInteraction,
  TextInputStyle,
} from "discord.js";
import { UserFlagsPolicy } from "../../structures/User";
import { BaseCommand } from "../BaseCommand";
import CommandMethod, { AnyInteraction, Method } from "../CommandMethod";
import app from "../../app";
import Subscription, { PatreonTierId } from "../../structures/Subscription";
import Response, {
  Action,
  MessageResponse,
  ResponseCodes,
} from "../../utils/Response";
import Util from "../../utils/Util";
import { CustomBotStatus } from "../../structures/CustomBot";
import ComponentMethod from "../ComponentMethod";

export default class Subscriptions extends BaseCommand {
  constructor() {
    super({
      flag: UserFlagsPolicy.NONE,
      memberPermissions: [],
      botPermissions: [],
      applicationCommandData: [
        {
          name: "subscriptions",
          description: "Manages your subscriptions",
          type: ApplicationCommandType.ChatInput,
        },
      ],
      messageComponent: (d) => {
        return d.matches("subscription") || d.matches("subscriptions");
      },
    });
  }

  public async chatInputCommandInteraction(
    dcm: CommandMethod<ChatInputCommandInteraction>
  ) {
    const subscription = await app.subscriptions.fetch(
      dcm.user.id,
      PatreonTierId.ONE_CUSTOM_BOT
    );

    if (!subscription)
      return new Response(ResponseCodes.NOT_SUBSCRIBED_YET, {
        ...dcm.locale.origin.commands.subscriptions.notSubscribedYet,
        ephemeral: true,
      });

    return Subscriptions.manageSubscription(dcm, subscription);
  }

  protected async modalSubmitInteraction(
    dcm: ComponentMethod<ModalSubmitInteraction>
  ) {
    const checker = await this.subscriptionComponentChecker(dcm);
    if (checker instanceof Response) return checker;

    if (checker?.path === "CREATE_CUSTOM_BOT") {
      const customBot = await app.customBots.create(
        dcm.user,
        dcm.d.fields.getTextInputValue("token")
      );
      dcm.cf.formats.set(
        "bot.tag",
        `${customBot.username}#${customBot.discriminator}`
      );
      dcm.cf.formats.set("bot.shortUUID", Util.getUUIDLowTime(customBot.id));
      return new Response(
        ResponseCodes.SUCCESS,
        {
          ...dcm.locale.origin.commands.subscriptions.manage.one.bot.setup
            .completed,
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                Util.backButton(
                  dcm.locale,
                  `subscription:tier:${checker.subscription.tierId}`
                ) as any,
                {
                  type: ComponentType.Button,
                  label:
                    dcm.locale.origin.commands.subscriptions.manage.one.bot
                      .setup.completed.buttons[0],
                  style: ButtonStyle.Primary,
                  customId: `subscription:tier:${checker.subscription.tierId}:bots:${customBot.id}`,
                },
              ],
            },
          ],
          ephemeral: true,
        },
        Action.UPDATE
      );
    }
    if (checker?.path === "SUBSCRIPTION_MANAGE")
      return Subscriptions.manageSubscription(dcm, checker.subscription);
  }

  protected async buttonInteraction(dcm: ComponentMethod<ButtonInteraction>) {
    //Manage single subscription
    const checker = await this.subscriptionComponentChecker(dcm);
    if (checker instanceof Response) return checker;

    if (checker?.path === "CREATE_CUSTOM_BOT")
      return new Response(
        ResponseCodes.SUCCESS,
        {
          title:
            dcm.locale.origin.commands.subscriptions.manage.one.bot.modals[0]
              .title,
          customId: `subscription:tier:${checker.subscription.tierId}:bots:create`,
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.TextInput,
                  style: TextInputStyle.Short,
                  label:
                    dcm.locale.origin.commands.subscriptions.manage.one.bot
                      .modals[0].textInput[0].label,
                  placeholder:
                    dcm.locale.origin.commands.subscriptions.manage.one.bot
                      .modals[0].textInput[0].placeholder,
                  customId: "token",
                },
              ],
            },
          ],
        },
        Action.MODAL
      );
    if (checker?.path === "SUBSCRIPTION_MANAGE")
      return Subscriptions.manageSubscription(dcm, checker.subscription);
  }

  protected async selectMenuInteraction(
    dcm: ComponentMethod<SelectMenuInteraction>
  ) {
    //Manage single subscription
    const checker = await this.subscriptionComponentChecker(
      dcm,
      dcm.d.values[0]
    );
    if (checker instanceof Response) return checker;

    if (checker?.path === "CREATE_CUSTOM_BOT")
      return new Response(
        ResponseCodes.SUCCESS,
        {
          ...dcm.locale.origin.commands.subscriptions.manage.one.bot.setup,
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                Util.backButton(
                  dcm.locale,
                  `subscription:tier:${checker.subscription.tierId}`
                ) as any,
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Primary,
                  customId: `subscription:tier:${checker.subscription.tierId}:bots:create`,
                  label:
                    dcm.locale.origin.commands.subscriptions.manage.one.bot
                      .setup.buttons[1],
                },
              ],
            },
          ],
          ephemeral: true,
        },
        Action.UPDATE
      );
    if (checker?.path === "SUBSCRIPTION_MANAGE")
      return Subscriptions.manageSubscription(dcm, checker.subscription);
  }

  private async subscriptionComponentChecker(
    dcm: ComponentMethod<any>,
    value?: string
  ): Promise<
    | Response<MessageResponse>
    | {
        subscription: Subscription;
        path: "CREATE_CUSTOM_BOT" | "SUBSCRIPTION_MANAGE";
      }
    | void
  > {
    if (dcm.getKey("subscription")) {
      const tierId = dcm.getValue("tier", true);
      if (!Object.values(PatreonTierId).includes(tierId as PatreonTierId))
        return new Response(
          ResponseCodes.UNKNOWN_SUBSCRIPTION_TIER,
          {
            ...dcm.locale.origin.commands.subscriptions.unknownSubscriptionTier,
            ephemeral: true,
          },
          Action.UPDATE
        );

      const subscription = await app.subscriptions.fetch(
        dcm.user.id,
        tierId as PatreonTierId
      );
      if (!subscription)
        return new Response(
          ResponseCodes.NOT_SUBSCRIBED_YET,
          {
            ...dcm.locale.origin.commands.subscriptions.notSubscribedYet,
            ephemeral: true,
          },
          Action.UPDATE
        );

      dcm.cf.formats.set("subscription.tier.name", subscription.getTierName());
      dcm.cf.formats.set(
        "subscription.expiredTimestamp",
        String(Math.round(subscription.getExpires().getTime() / 1000))
      );
      dcm.cf.formats.set(
        "subscription.tier.checkout.url",
        "https://www.patreon.com/join/xtopbot/checkout?rid=" +
          subscription.tierId
      );
      if (!subscription.isActive())
        return new Response(
          ResponseCodes.SUBSCRIPTION_EXPIRED,
          {
            ...dcm.locale.origin.commands.subscriptions.subscriptionExpired,
            ephemeral: true,
          },
          Action.UPDATE
        );

      if (dcm.getKey("bots")) {
        const customBots = await app.customBots.fetch(
          dcm.user.id,
          subscription.tierId
        );
        if (dcm.getKey("create") || value === "create") {
          if (customBots.remaining <= 0)
            return new Response(
              ResponseCodes.CREATE_CUSTOM_BOT_LIMIT_REACHED,
              {
                ...dcm.locale.origin.commands.subscriptions
                  .createCustomBotLimitReached,
                ephemeral: true,
              },
              Action.UPDATE
            );
          return {
            subscription: subscription,
            path: "CREATE_CUSTOM_BOT",
          };
        }
      }
      return {
        subscription: subscription,
        path: "SUBSCRIPTION_MANAGE",
      };
    }
  }

  public static async manageSubscription(
    dcm: Method<AnyInteraction>,
    subscription: Subscription
  ) {
    const customBots = await app.customBots.fetch(
      dcm.user.id,
      subscription.tierId
    );

    const components: any = [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            label:
              dcm.locale.origin.commands.subscriptions.manage.one.buttons[0],
            style: ButtonStyle.Link,
            url: "https://www.patreon.com/join/xtopbot/checkout?edit=1",
          },
        ],
      },
    ];
    const selectMenuCustomBotsOptions = customBots.items.map((cb) => ({
      label: `${cb.username}#${cb.discriminator} (${Util.getUUIDLowTime(
        cb.id
      )})`,
      description:
        dcm.locale.origin.commands.subscriptions.manage.one.selectMenu[0]
          .options[
          cb.getStatus() === CustomBotStatus.ONLINE
            ? 1
            : cb.getStatus() === CustomBotStatus.TOKEN_INVALID
            ? 2
            : 3
        ].description,
      emoji: {
        name:
          cb.getStatus() === CustomBotStatus.ONLINE
            ? "🟢"
            : cb.getStatus() === CustomBotStatus.TOKEN_INVALID
            ? "🟠"
            : "🔴",
      },
      value: cb.id,
    }));

    for (let i = 0; i < customBots.remaining; i++) {
      selectMenuCustomBotsOptions.push({
        label: "Bot#0000",
        description:
          dcm.locale.origin.commands.subscriptions.manage.one.selectMenu[0]
            .options[0].description,
        emoji: {
          name: "⚪",
        },
        value: "create",
      });
    }

    if (selectMenuCustomBotsOptions.length > 0)
      components.push({
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.SelectMenu,
            placeholder:
              dcm.locale.origin.commands.subscriptions.manage.one.selectMenu[0]
                .placeholder,
            customId: `subscription:tier:${subscription.tierId}:bots:manage`,
            options: selectMenuCustomBotsOptions,
            disable: !subscription.isActive(),
          },
        ],
      });

    dcm.cf.formats.set("subscription.tier.name", subscription.getTierName());
    dcm.cf.formats.set(
      "subscription.id",
      subscription.getLastSubscriptionPaidId()
    );
    dcm.cf.formats.set(
      "subscription.description",
      dcm.locale.origin.commands.subscriptions.tierDescription[
        subscription.tierId
      ] ?? ""
    );
    dcm.cf.formats.set(
      "subscription.createdTimestamp",
      String(Math.round(subscription.getCreatedAt().getTime() / 1000))
    );
    dcm.cf.formats.set(
      "subscription.status",
      subscription.isActive()
        ? dcm.locale.origin.commands.subscriptions.subscriptionStatus.active
        : dcm.locale.origin.commands.subscriptions.subscriptionStatus.expired
    );
    dcm.cf.formats.set(
      "subscription.status.description",
      Util.quickFormatContext(
        subscription.isActive()
          ? dcm.locale.origin.commands.subscriptions.manage.one.status.expires
          : dcm.locale.origin.commands.subscriptions.manage.one.status.expired,
        {
          "subscription.expiresTimestamp": Math.round(
            subscription.getExpires().getTime() / 1000
          ),
        }
      )
    );
    dcm.cf.formats.set(
      "subscription.totalPaid",
      subscription.getTotalPaidAmount(false)
    );
    return new Response(
      ResponseCodes.SUCCESS,
      {
        ...dcm.locale.origin.commands.subscriptions.manage.one,
        components,
        ephemeral: true,
      },
      [InteractionType.MessageComponent, InteractionType.ModalSubmit].includes(
        dcm.d.type
      )
        ? Action.UPDATE
        : Action.REPLY
    );
  }
}
