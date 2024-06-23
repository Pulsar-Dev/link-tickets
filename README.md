# Pulsar Link Tickets
Pulsar Tickets is a Discord Bot written in Deno using the Harmony library.
It is designed to be used with the rest of the Pulsar Link project and will not function without them.

## Features
- Ticket creation and closing
- Ticket message logging

## Commands
- `/create {addon}` - Creates a ticket for the specified addon
- `/hold` - Places a ticket on hold
- `/unhold` - Takes a ticket out of hold
- `/close` - Closes a ticket
- `/ping` - Pings the bot

## Installation
1. Download the latest release from the [releases page](https://github.com/Pulsar-Dev/link-tickets/releases/latest). Only Linux x86_64 builds are provided.
2. Create a `.env` file based on [`.env.example`](https://github.com/Pulsar-Dev/link-tickets/blob/master/.env.example)
3. Run the bot with `./pulsar-link-tickets`

## Building
1. Install [Deno](https://deno.com/)
2. Clone the repository
3. Create a `.env` file based on [`.env.example`](https://github.com/Pulsar-Dev/link-tickets/blob/master/.env.example)
4. Run the bot with `deno task dev`

### Building a release
1. Run `deno task compile` - Will only build a Linux x86_64 binary
2. Run the binary with `./pulsar_link_tickets-linux_x86_64`