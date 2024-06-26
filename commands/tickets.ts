import {
  ApplicationCommandOption,
  ApplicationCommandOptionType,
  ApplicationCommandPartial,
  ApplicationCommandsModule,
  ChannelTypes,
  GuildTextChannel,
  Interaction,
  logger,
  OverwriteType,
  slash,
  TextChannel
} from "../deps.ts";
import {addons as addonsJson} from "../addons.ts";
import {Addon, TicketCreateResponse} from "../types.ts";
import {get, insert, remove, setUserCache} from "../helpers/db.ts";
import {
  APITicket,
  APITicketStatus,
  APIUser, APIUserAddon, APIUserAddons,
  close,
  create,
  get as APIGet,
  getUser, getUserAddons,
  hold,
  unhold
} from "../helpers/api.ts";

const addons: Addon[] = await fetch(`${Deno.env.get("API_URL")!}/addons`, {
  method: "GET",
  headers: {
    "Authorization": `${Deno.env.get("API_TOKEN")}`,
  },
}).then(async (res) => await res.json()).catch((err) => {
  logger.error(err);
  return [];
});

addons.forEach((addon: Addon) => {
  addon.shortName = addonsJson[addon.id];
});

const options: ApplicationCommandOption[] = [];

options.push({
  name: "addon",
  description: "Addon to create a ticket for.",
  type: ApplicationCommandOptionType.STRING,
  required: true,
  choices: addons.map((addon: Addon) => {
    return {
      name: addon.name,
      value: addon.id,
    };
  }),
});

export class TicketCommandsModule extends ApplicationCommandsModule {
  name = "Tickets";

  commandData: ApplicationCommandPartial[] = [
    {
      name: "create",
      description: "Create a new ticket.",
      options: options,
    },
    {
      name: "close",
      description: "Close a ticket.",
      options: [],
    },
    {
      name: "hold",
      description: "Places a ticket on hold.",
      options: [],
    },
    {
      name: "unhold",
      description: "Removes a ticket from hold.",
      options: [],
    },
  ];

  @slash("create")
  async create(interaction: Interaction): Promise<void> {
    if (!interaction.isApplicationCommand()) {
      interaction.reply("What the fuck. This should never happen?", {ephemeral: true});
      logger.error("Error creating ticket: Interaction is not an application command.")
      return;
    }
    if (!interaction.member?.user) {
      interaction.reply("You must be in a server to use this command.", {ephemeral: true});
      logger.error("Error creating ticket: interaction.member.user is undefined")
      return;
    }

    if (!interaction.guild) {
      interaction.reply("You must be in a server to use this command.", {ephemeral: true});
      logger.error("Error creating ticket: interaction.guild is undefined")
      return;
    }

    if (!interaction.options[0]?.value) {
      interaction.reply("Missing addon. Please create the ticket by specifying an addon.", {ephemeral: true});
      logger.error("Error creating ticket: Missing addon option")
      return;
    }

    const apiUser = await getUser(interaction.member.user.id)

    if (apiUser.error) {
      interaction.reply("An unknown error has occurred whilst creating the ticket.", {ephemeral: true});
      logger.error("Error creating ticket: API fetch failed: ", apiUser.error);
      return;
    }

    const apiUserData = apiUser.data;

    if (!apiUserData) {
      interaction.reply("An unknown error has occurred whilst creating the ticket.", {ephemeral: true});
      logger.error("Error creating ticket: API fetch failed: ", apiUserData);
      return;
    }

    const apiUserResponse: APIUser = await apiUserData.json();

    if (apiUserResponse.error) {
      interaction.reply("You have not verified. Please verify to create tickets.", {ephemeral: true});
      logger.error("Error creating ticket: API returned error: ", apiUserResponse.error);
      return;
    }

    setUserCache(interaction.member.user.id, apiUserResponse.id!)

    const apiUserAddons = await getUserAddons(apiUserResponse.id!);
    if (apiUserAddons.error) {
      interaction.reply("An unknown error has occurred whilst creating the ticket.", {ephemeral: true});
      logger.error("Error creating ticket: API returned error for user addons: ", apiUser.error);
      return;
    }

    const apiUserAddonsData = apiUserAddons.data;

    if (!apiUserAddonsData) {
      interaction.reply("An unknown error has occurred whilst creating the ticket.", {ephemeral: true});
      logger.error("Error creating ticket: API fetch failed for user addons: ", apiUserAddonsData);
      return;
    }

    if (!apiUserAddonsData.ok) {
      interaction.reply("An unknown error has occurred whilst creating the ticket.", {ephemeral: true});
      logger.error("Error creating ticket: API request failed for user addons: ", apiUserAddonsData);
      return;
    }

    const apiUserAddonsResponse: APIUserAddons = await apiUserAddonsData.json();

    if (!apiUserAddonsResponse || apiUserAddonsResponse.length === 0) {
      interaction.reply("You do not own any addons. Please purchase an addon to create a ticket for it.", {ephemeral: true});
      return;
    }

    const userOwnsAddon = Boolean(apiUserAddonsResponse.find((addon: APIUserAddon) => addon.id === interaction.options[0].value));

    if (!userOwnsAddon) {
      interaction.reply("You do not own this addon. Please purchase the addon to create a ticket for it.", {ephemeral: true});
      return;
    }

    const apiTicket = await create(
      interaction.member.user.id,
      interaction.options[0].value,
    );

    if (apiTicket.error) {
      interaction.reply("An unknown error has occurred whilst creating the ticket.", {ephemeral: true});
      logger.error("Error creating ticket: API fetch failed for ticket: ", apiTicket.error);
      return;
    }

    const data = apiTicket.data;

    if (!data) {
      interaction.reply("An unknown error has occurred whilst creating the ticket.", {ephemeral: true});
      logger.error("Error creating ticket: API fetch failed for ticket: ", data);
      return;
    }

    const response: TicketCreateResponse = await data.json();

    if (data.status == 400) {
      if (response.error === "User already has an open ticket for this addon.") {
        interaction.reply("You already have an open ticket for this addon.", {ephemeral: true});
        return;
      }

      interaction.reply("An error occurred whilst creating the ticket.", {ephemeral: true});
      logger.error("Error creating ticket: API returned 400: ", response.error);
      return;
    }

    if (!response || !response.id || response.error) {
      interaction.reply(response.error || "An unknown error has occurred whilst creating the ticket.", {ephemeral: true});
      logger.error("Error creating ticket: API returned error: ", response.error);
      return;
    }

    const ticketChannel = await interaction.guild?.channels.create({
      name: `ticket-${response.id?.split("-")[0]}`,
      type: ChannelTypes.GUILD_TEXT,
    });

    if (!ticketChannel) {
      interaction.reply("An error occurred whilst creating the ticket.", {ephemeral: true});
      return;
    }

    ticketChannel.addOverwrite({
      id: interaction.guild.id,
      type: OverwriteType.ROLE,
      deny: "1024",
    });

    ticketChannel.addOverwrite({
      id: interaction.member.user.id,
      type: OverwriteType.USER,
      allow: "1024",
    });

    const addon = apiUserAddonsResponse.find((addon: APIUserAddon) => addon.id === interaction.options[0].value)

    const ticketTextChannel = ticketChannel as GuildTextChannel as TextChannel;
    await ticketTextChannel.send(`Welcome <@${interaction.user.id}>!\nThis ticket is about: **${addon?.name || "Unknown Addon?"}**\n\nPlease describe your issue and a staff member will be with you shortly.`);

    insert(response.id, ticketChannel.id, interaction.member.user.id);

    interaction.reply(`Ticket created! <#${ticketChannel.id}>`, {
      ephemeral: true,
    });
  }

  @slash("close")
  async close(interaction: Interaction): Promise<void> {
    if (!interaction.isApplicationCommand()) {
      interaction.reply("What the fuck. This should never happen?", {ephemeral: true});
      return;
    }
    if (!interaction.member?.user) {
      interaction.reply("You must be in a server to use this command.", {ephemeral: true});
      return;
    }

    if (!interaction.guild) {
      interaction.reply("You must be in a server to use this command.", {ephemeral: true});
      return;
    }

    if (!interaction.channel) {
      interaction.reply("You must be in a channel to use this command.", {ephemeral: true});
      return;
    }

    const ticket = await get(interaction.channel.id);

    if (ticket.channel_id === "" || ticket.ticket_id === "" || ticket.creator === "") {
      interaction.reply("This channel is not a ticket!", {ephemeral: true});
      return;
    }

    const isAdmin = Boolean(await interaction.member.roles.get(Deno.env.get("ADMIN_ROLE")!));

    if ((interaction.member.user.id !== ticket.creator) && !isAdmin) {
      interaction.reply("You are not able to close this ticket as you are not the creator or an admin!", {ephemeral: true});
      return
    }

    interaction.reply("Ticket closing in 5 seconds.");

    setTimeout(async () => {
      interaction.send("Closing ticket...");

      const channel = await interaction.guild!.channels.fetch(
        interaction.channel!.id,
      );

      if (!channel) {
        interaction.send("An error occurred whilst closing the ticket.");
        logger.error("Error closing ticket: Channel fetch failed.")
        return;
      }

      remove(interaction.channel!.id);

      const apiTicket = await close(ticket.ticket_id);

      if (apiTicket.error) {
        interaction.reply("An unknown error has occurred whilst closing the ticket.", {ephemeral: true});
        logger.error("Error closing ticket: API fetch failed: ", apiTicket.error);
        return;
      }

      const data = apiTicket.data;

      if (!data || !data.ok) {
        interaction.send("An error occurred whilst closing the ticket.");
        logger.error(`Error closing ticket: API request failed: ${data}`);
        return;
      }

      const response: APITicketStatus = await data.json()

      if (response.error) {
        interaction.send("An error occurred whilst closing the ticket.");
        logger.error(`Error closing ticket: API returned error: ${response.error}`);
        return;
      }

      if (!response.success) {
        interaction.send("An error occurred whilst closing the ticket.");
        logger.error(`Error closing ticket: API returned non success: ${response.error}`);
        return;
      }

      channel.delete();
    }, 5000);
  }

  @slash("hold")
  async hold(interaction: Interaction): Promise<void> {
    if (!interaction.isApplicationCommand()) {
      interaction.reply("What the fuck. This should never happen?", {ephemeral: true});
      return;
    }
    if (!interaction.member?.user) {
      interaction.reply("You must be in a server to use this command.", {ephemeral: true});
      return;
    }

    if (!interaction.guild) {
      interaction.reply("You must be in a server to use this command.", {ephemeral: true});
      return;
    }

    if (!interaction.channel) {
      interaction.reply("You must be in a channel to use this command.", {ephemeral: true});
      return;
    }

    const ticket = await get(interaction.channel.id);

    if (ticket.channel_id === "" || ticket.ticket_id === "" || ticket.creator === "") {
      interaction.reply("This channel is not a ticket!", {ephemeral: true});
      return;
    }

    const isAdmin = Boolean(await interaction.member.roles.get(Deno.env.get("ADMIN_ROLE")!));

    if ((interaction.member.user.id !== ticket.creator) && !isAdmin) {
      interaction.reply("You are not able to put this ticket on hold as you are not the creator or an admin!", {ephemeral: true});
      return
    }

    const apiTicketGet = await APIGet(ticket.ticket_id);
    const apiGetData = apiTicketGet.data;

    if (!apiGetData || !apiGetData.ok) {
      interaction.reply("An error occurred whilst putting ticket on hold.");
      logger.error(`Error holding ticket: API request failed to get: ${apiGetData}`);
      return;
    }

    const getResponse: APITicket = await apiGetData.json()

    if (getResponse.status === "HOLD") {
      interaction.reply("Ticket is already on hold.");
      return;
    }

    const channel = await interaction.guild!.channels.fetch(
      interaction.channel!.id,
    );

    if (!channel) {
      interaction.send("An error occurred whilst putting ticket on hold.");
      logger.error("Error holding ticket: Channel fetch failed.")
      return;
    }

    const apiTicket = await hold(ticket.ticket_id);

    if (apiTicket.error) {
      interaction.reply("An unknown error has occurred whilst putting ticket on hold.", {ephemeral: true});
      logger.error("Error holding ticket: API fetch failed: ", apiTicket.error);
      return;
    }

    const data = apiTicket.data;

    if (!data || !data.ok) {
      interaction.reply("An error occurred whilst putting ticket on hold.");
      logger.error(`Error holding ticket: API request failed: ${data}`);
      return;
    }

    const response: APITicketStatus = await data.json()

    if (response.error) {
      interaction.reply("An error occurred whilst putting ticket on hold.");
      logger.error(`Error holding ticket: API returned error: ${response.error}`);
      return;
    }

    if (!response.success) {
      interaction.reply("An error occurred whilst putting ticket on hold.");
      logger.error(`Error holding ticket: API returned non success: ${response.error}`);
      return;
    }

    let name = channel.name;
    name = name.replace("ticket", "hold")

    channel.edit({
      name: name
    })

    interaction.reply("Ticket put on hold.");
  }

  @slash("unhold")
  async unhold(interaction: Interaction): Promise<void> {
    if (!interaction.isApplicationCommand()) {
      interaction.reply("What the fuck. This should never happen?", {ephemeral: true});
      return;
    }
    if (!interaction.member?.user) {
      interaction.reply("You must be in a server to use this command.", {ephemeral: true});
      return;
    }

    if (!interaction.guild) {
      interaction.reply("You must be in a server to use this command.", {ephemeral: true});
      return;
    }

    if (!interaction.channel) {
      interaction.reply("You must be in a channel to use this command.", {ephemeral: true});
      return;
    }

    const ticket = await get(interaction.channel.id);

    if (ticket.channel_id === "" || ticket.ticket_id === "" || ticket.creator === "") {
      interaction.reply("This channel is not a ticket!", {ephemeral: true});
      return;
    }

    const isAdmin = Boolean(await interaction.member.roles.get(Deno.env.get("ADMIN_ROLE")!));

    if ((interaction.member.user.id !== ticket.creator) && !isAdmin) {
      interaction.reply("You are not able to take this ticket out of hold as you are not the creator or an admin!", {ephemeral: true});
      return
    }

    const apiTicketGet = await APIGet(ticket.ticket_id);
    const apiGetData = apiTicketGet.data;

    if (!apiGetData || !apiGetData.ok) {
      interaction.reply("An error occurred whilst taking ticket out of hold.");
      logger.error(`Error unholding ticket: API request failed to get: ${apiGetData}`);
      return;
    }

    const getResponse: APITicket = await apiGetData.json()

    if (getResponse.status === "OPEN") {
      interaction.reply("Ticket is not on hold");
      return;
    }

    const channel = await interaction.guild!.channels.fetch(
      interaction.channel!.id,
    );

    if (!channel) {
      interaction.reply("An error occurred whilst taking ticket out of hold.");
      logger.error("Error unholding ticket: Channel fetch failed.")
      return;
    }

    const apiTicket = await unhold(ticket.ticket_id);

    if (apiTicket.error) {
      interaction.reply("An unknown error has occurred whilst taking ticket out of hold.", {ephemeral: true});
      logger.error("Error unholding ticket: API fetch failed: ", apiTicket.error);
      return;
    }

    const data = apiTicket.data;

    if (!data || !data.ok) {
      interaction.reply("An error occurred whilst taking ticket out of hold.");
      logger.error(`Error unholding ticket: API request failed: ${data}`);
      return;
    }

    const response: APITicketStatus = await data.json()

    if (response.error) {
      interaction.reply("An error occurred whilst taking ticket out of hold.");
      logger.error(`Error unholding ticket: API returned error: ${response.error}`);
      return;
    }

    if (!response.success) {
      interaction.reply("An error occurred whilst taking ticket out of hold.");
      logger.error(`Error unholding ticket: API returned non success: ${response.error}`);
      return;
    }

    let name = channel.name;
    name = name.replace("hold", "ticket")

    channel.edit({
      name: name
    })

    interaction.reply("Ticket taken out of hold.");
  }
}
