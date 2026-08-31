# Sankore Balance Manager

Build a modern light/dark mode web first but moobile responsive dasaboard called Sankore Fund Manager. This manaager will be build out in phases and this is to have left ccollapsible side menu desgin tto allow for more modular functinality to be added in the future. Use Outfit font ,  use hexcode 0B1D40, 0B1D40 93CDC5, with mix highlight in light mode. Clean minimal modern design with slightly rouuded edges

Starting witth the dashboard, Phase 1: Transaction Management Core 

• TM-01 (User Balance Engine): The system shall calculate and track user balances in

real-time. Balance updates must occur within 1 second of transaction commit. Showing users transactions, 

• TM-02 (Audit Logger): The system shall log all transactions immutably, capturing

timestamps, user IDs, IP addresses, and previous/new states.

• TM-03 (Account Verification): The system shall enforce automated validation rules

to verify account details prior to authorizing transactions.

• TM-04 (Integrity Constraints): The database layer must reject any orphaned trans-

actions or negative balances where prohibited by fund rules

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://fundmanager-v01.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c26ac27a-dbd8-4ed4-807f-fee3295f7daa).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
