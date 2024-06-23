import {
  ApplicationCommandOption,
  ApplicationCommandOptionType,
  ApplicationCommandPartial,
  ApplicationCommandsModule,
  ChannelTypes,
  Interaction,
  logger,
  OverwriteType,
  slash,
} from "../deps.ts";
import {addons as addonsJson} from "../addons.ts";
import {Addon, TicketCreateResponse} from "../types.ts";
import {get, insert, remove, setUserCache} from "../helpers/db.ts";
import {
  APITicket,
  APITicketStatus,
  APIUser,
  close,
  create,
  get as APIGet,
  getUser,
  hold,
  unhold
} from "../helpers/api.ts";

const addons: Addon[] = await fetch("http://localhost:8080/addons", {
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

    if (!interaction.options[0]?.value) {
      interaction.reply("Missing addon. Please create the ticket by specifying an addon.", {ephemeral: true});
      return;
    }

    const apiUser = await getUser(interaction.member.user.id)

    if (apiUser.error) {
      interaction.reply("An unknown error has occurred whilst creating the ticket.", {ephemeral: true});
      return;
    }

    const apiUserData = apiUser.data;

    if (!apiUserData) {
      interaction.reply("An unknown error has occurred whilst creating the ticket.", {ephemeral: true});
      return;
    }

    const apiUserResponse: APIUser = await apiUserData.json();

    if (apiUserResponse.error) {
      interaction.reply("You have not verified. Please verify to create tickets.", {ephemeral: true});
      return;
    }

    await setUserCache(interaction.member.user.id, apiUserResponse.id!)

    const apiTicket = await create(
      interaction.member.user.id,
      interaction.options[0].value,
    );

    if (apiTicket.error) {
      interaction.reply("An unknown error has occurred whilst creating the ticket.", {ephemeral: true});
      return;
    }

    const data = apiTicket.data;

    if (!data) {
      interaction.reply("An unknown error has occurred whilst creating the ticket.", {ephemeral: true});
      return;
    }

    const response: TicketCreateResponse = await data.json();

    if (data.status == 400) {
      interaction.reply("An error occurred whilst creating the ticket.", {ephemeral: true});
      logger.error(response);
      return;
    }

    if (!response || !response.id || response.error) {
      interaction.reply(response.error || "An unknown error has occurred whilst creating the ticket.", {ephemeral: true});
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
