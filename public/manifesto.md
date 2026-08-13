# The legible agent

*A manifesto — Daniel Albinsson*

We are handing agents the keys.

Not chatbots that answer questions, but delegates that do the work: read the inbox, move the money, touch the customer's data, act while we sleep. The moment you delegate, one question outranks every benchmark and demo — **what is this thing actually allowed to do?**

Right now there is almost no honest way to answer it. You clone an agent someone else built, and to learn what it can reach, what it does on its own, and what it asks permission for, you read the source. Trust becomes an act of faith, or of unpaid due diligence. That is a strange way to hand something authority.

I think this is the design problem of the era — and almost nobody is working on it.

## Capability is not the scarce thing

The labs and frameworks are racing on capability. Agents get more powerful every month, and they will keep doing so without my help. What is *not* improving at the same rate is our ability to **understand** the things we're delegating to. Comprehension and trust are lagging capability, and the gap is where the accidents live.

So the interesting work isn't making agents do more. It's making them **legible** — able to be understood, at a glance, by the person who's about to rely on them. That's a design discipline, not a model problem, and it doesn't have an owner yet.

## Agents should be able to explain themselves

An agent's definition already contains the truth: its tools, its reach, its schedules, what it has been forbidden from doing. That truth is just buried in code. A legible agent surfaces it — in plain language, first person, without you having to go spelunking.

Not a dashboard. Not a flowchart. A **self-portrait**: here is what I can do, here is what I can touch, here is when I act on my own, here is what I cannot do.

## Trust must be built from verifiable facts

This is the line I will not cross: **never present a guess as a fact.** A trust tool that flatters you with false confidence is worse than no tool at all.

So every claim carries its provenance. What can be proven from the build, I show as verified. What I can only infer from source, I label as inferred. Where the framework won't expose something, I refuse to render it — even when I easily could, even when it would look more complete. The honest gap is the feature. Showing what I *can't* verify is how you know to trust what I can.

Call it the **honesty contract**. It's the whole thing.

## The question is not just "what," but "what changed"

Agents update. They gain a tool, reach a new system, start acting on a schedule, swap a model, drop an approval gate. Any of those can expand what the agent is allowed to do — and an expansion of authority is exactly the moment a human should be asked to look.

So legibility has a time axis. The most important view isn't the snapshot; it's the **diff**: *this version gives the agent more power than the last one — review required.* Routine changes should pass without a flag. Authority changes should stop and ask.

## Aletheia

Aletheia is the proof. Point it at any [eve](https://eve.dev) agent and it renders that self-portrait and that authority diff. It reads; it never runs or deploys. It shows verified facts where it can and marks the rest honestly. It makes an agent you didn't write understandable in the time it takes to read a paragraph.

It's deliberately small. It's not trying to be a platform. It's an argument, made in working software, for a way of designing.

The name is Greek: *aletheia*, truth as **unconcealment** — bringing what is hidden into the open. That's the job. As we delegate more of our lives to agents, someone has to design for the human on the other side of the delegation — the one who needs to understand, and to trust, before they hand over the keys.

That's the work I want to do.

— Daniel
## Sitemap

See the full [sitemap](/sitemap.md) for all pages.
