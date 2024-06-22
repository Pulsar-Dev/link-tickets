import {
  ApplicationCommandOption,
  ApplicationCommandOptionType,
  ApplicationCommandPartial,
  ApplicationCommandsModule,
  Interaction,
  logger,
  slash,
} from "../deps.ts";
import {addons as addonsJson} from "../addons.ts";
import {Addon, TicketCreateResponse} from "../types.ts";
import { database } from "../mod.ts";

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
  })
});

export class TicketCommandsModule extends ApplicationCommandsModule {
  name = "Tickets";

  commandData: ApplicationCommandPartial[] = [
    {
      name: "create",
      description: "Create a new ticket.",
      options: options,
    },
  ];

  @slash("create")
  async create(interaction: Interaction): Promise<void> {
    if (!interaction.isApplicationCommand()) {
      interaction.reply("What the fuck. This should never happen?")
      return
    }
    if (!interaction.member?.user) {
      interaction.reply("You must be in a server to use this command.");
      return;
    }

    if (!interaction.options[0]?.value) {
      interaction.reply("Missing addon. Please create the ticket by specifying an addon.")
      return
    }

    const url = new URL("http://localhost:8080/ticket/create");
    url.searchParams.append("creator", interaction.member.user.id);
    url.searchParams.append("addon", interaction.options[0].value);

    const data = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${Deno.env.get("API_TOKEN")}`,
      },
    }).catch((err) => {
      interaction.reply("There was an error creating the ticket.");
      logger.error(err);
    });

    if (!data) {
      interaction.reply("An unknown error has occured whilst creating the ticket.")
      return
    }

    const response: TicketCreateResponse = await data.json()

    if (response.error) {
      interaction.reply(response.error);
      return
    }

    database.execute(`
    
    `)

    interaction.reply("Ticket created!");
  }
}
