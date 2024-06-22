import { Interaction, SlashCommandPartial } from "./deps.ts";

export interface PulsarTicketsCommand extends SlashCommandPartial {
  execute: (interaction: Interaction) => Promise<void>;
}
