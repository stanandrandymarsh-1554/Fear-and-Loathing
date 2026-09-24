/* ============================================================
   THE GAME — chemistry, errands, and conversation.

   Design rule: no substance is a power-up and none is a penalty.
   Each one buys exactly one capability and sells off the others —
   and each acts on a DIFFERENT system, so they never stack into
   one generic "high". The roster and what each one does live in
   the SUBSTANCES table below; nothing else in the codebase knows
   the name of a single drug.

   Four stats come out of it:

     NERVE       whether you can make yourself say the hard thing
     PERCEPTION  whether you can see what is actually in the room
     COMPOSURE   whether the words come out in the right order
     MOTOR       whether your legs are still taking instructions

   Sober you cannot make yourself speak. Loaded you cannot make
   yourself understood. The game is the gap between.
   ============================================================ */

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ============================================================
   THE BRIEFCASE

   The kit is the one from the trunk in the film: grass, mescaline,
   blotter acid, cocaine, a galaxy of uppers and downers, tequila,
   raw ether, amyls. Adrenochrome is the one you cannot bring with
   you — you have to find somebody willing to sell it.

   Nothing is hardcoded to a shader. Each substance says how hard it
   pushes five EFFECT CHANNELS and how it moves your stats; the
   renderer and the audio engine only ever see the channels.

   The channels are drawn along the lines real drugs actually divide
   along, which is why they don't collapse into one generic "high":

     psych    hallucinogenic distortion — hue roll, geometry, surfaces
              breathing, trails, people who are not in the room.
              Mescaline and acid. NOT stimulants.
     rush     sympathetic arousal — heart slamming, contrast biting,
              focus narrowing, hands not still. Cocaine, speed, amyls.
              No hallucination: a stimulant does not melt the walls.
     blur     intoxicant smearing — double vision, soft edges, sway.
              Drink, downers, ether, a little grass.
     dim      depressant / dissociative withdrawal — colour drains,
              the lights go a long way off, the edges close in.
              Ether and downers.
     monster  reserved for adrenochrome, which is the only fictional
              thing in the case and the only thing that inverts the
              world and locks you in place.

   BASELINE IS CLEAN. Sober, every channel is zero and the screen
   gets no grain, no aberration, no trails, no vignette, and the
   audio gets no drone — only the room you are standing in.
   ============================================================ */
export const SUBSTANCES = {
  // mild perceptual lift, time dilation, short-term memory slipping.
  // Not a hallucinogen: nothing melts, you just lose the thread.
  grass: {
    name: 'GRASS', glyph: '❦', key: '1', color: '#6fbf4a', price: 25,
    dose: 0.70, decay: 0.0120, loathing: 0.02,
    fx: { psych: 0.16, blur: 0.26, dim: 0.06 },
    stat: { fearOff: 0.50, perception: 0.20, composure: -0.30,
            motorLoss: 0.18, slowClock: 0.5, paranoia: 0.85 },
  },

  // the classic: geometry, colour, surfaces breathing, a long ride.
  // Coordination stays: you can walk fine, you just can't explain why.
  mescaline: {
    name: 'MESCALINE', glyph: '✦', key: '2', color: '#a03cff', price: 60,
    dose: 0.85, decay: 0.0092, loathing: 0.09,
    fx: { psych: 1.00 },
    stat: { perception: 1.05, composure: -0.55, fearOff: 0.15, slowClock: 0.35,
            paranoia: 0.35 },
  },

  // the longest and the strongest picture. Motor control is largely
  // intact — acid does not take your legs, it takes your grammar.
  acid: {
    name: 'BLOTTER ACID', glyph: '◈', key: '3', color: '#ff7ad9', price: 80,
    dose: 1.00, decay: 0.0045, loathing: 0.12,
    fx: { psych: 1.40 },
    stat: { perception: 1.30, composure: -1.00, fearOff: 0.05,
            nerve: 0.10, motorLoss: 0.12, slowClock: 1.0, paranoia: 0.85 },
  },

  // confidence, speed of speech, a jaw that will not sit still, and
  // about half an hour of it. No visuals — stimulants do not hallucinate.
  cocaine: {
    name: 'COCAINE', glyph: '❄', key: '4', color: '#ffffff', price: 90,
    dose: 0.90, decay: 0.0190, loathing: 0.16,
    fx: { rush: 0.85 },
    // the only thing in the case that makes you sharper to talk to
    // paranoia is the comedown's, not the line's -- pitched low on purpose,
    // because a bigger number here ate the nerve bonus it is supposed to buy
    // and put the dealer's hardest option back out of reach
    stat: { nerve: 0.80, composure: 0.30, fearOff: 0.50, jitter: 0.55,
            paranoia: 0.30 },
  },

  uppers: {
    name: 'UPPERS', glyph: '▲', key: '5', color: '#ffb400', price: 30,
    dose: 0.80, decay: 0.0120, loathing: 0.07,
    fx: { rush: 0.60 },
    stat: { nerve: 0.45, composure: -0.10, fearOff: 0.20, jitter: 0.85,
            speed: 0.35, paranoia: 0.30 },
  },

  // sedation and ataxia: the legs go, the speech slurs, the room recedes
  downers: {
    name: 'DOWNERS', glyph: '▼', key: '6', color: '#5a7fd0', price: 30,
    dose: 0.85, decay: 0.0140, loathing: 0.06,
    fx: { blur: 0.60, dim: 0.75 },
    stat: { fearOff: 1.00, motorLoss: 0.85, composure: -0.75,
            speed: -0.30, slowClock: 0.3 },
  },

  tequila: {
    name: 'TEQUILA', glyph: '▾', key: '7', color: '#e8c14a', price: 15,
    dose: 0.55, decay: 0.0230, loathing: 0.045,
    fx: { blur: 0.85, dim: 0.12 },
    stat: { fearOff: 0.70, motorLoss: 0.45, composure: -0.50, nerve: 0.30 },
  },

  // the film is explicit about this one: total loss of all basic motor
  // skills, blurred vision, no balance, numb tongue. So: blur AND dim,
  // and every last bit of the motor channel.
  ether: {
    name: 'ETHER', glyph: '◍', key: '8', color: '#12e2e2', price: 40,
    dose: 0.78, decay: 0.0165, loathing: 0.05,
    fx: { blur: 0.55, dim: 0.95 },
    stat: { fearOff: 0.95, motorLoss: 1.00, composure: -0.75,
            nerve: 0.40, slowClock: 1.0 },
  },

  // thirty seconds of the blood arriving all at once, then a headache
  amyls: {
    name: 'AMYLS', glyph: '❍', key: '9', color: '#ff5a2d', price: 35,
    dose: 1.00, decay: 0.0900, loathing: 0.05,
    fx: { rush: 1.30, blur: 0.25 },
    // and the blood pressure drops out from under him for a few seconds
    stat: { nerve: 1.10, composure: -0.45, fearOff: 0.35, jitter: 0.90,
            motorLoss: 0.30 },
  },

  // the only invented thing in the case. It inverts the world and it
  // puts you on the floor — in the film he cannot move at all.
  adrenochrome: {
    name: 'ADRENOCHROME', glyph: '✚', key: '0', color: '#ff2d1f', price: 0,
    dose: 1.00, decay: 0.0105, loathing: 0.26,
    fx: { psych: 1.10, rush: 1.00, monster: 1.00 },
    stat: { nerve: 1.00, perception: 0.25, composure: -0.95, fearOff: 0.90,
            jitter: 0.40, motorLoss: 0.50, slowClock: 0.8 },
  },
};

const KEYS = Object.keys(SUBSTANCES);

/* ============================================================
   DIALOGUE
   ============================================================ */
const R = (stat, min) => ({ stat, min });

const DIALOGUE = {
  /* ---------------------------------------------- front desk */
  clerk: {
    start: 'c0',
    nodes: {
      c0: {
        who: 'SWAN — NIGHT DESK',
        line: 'You’ll be checking in. I need a name, and I need you to stop swaying.',
        time: 9,
        options: [
          { text: 'Duke. Two rooms. The magazine arranged the credit.',
            req: R('composure', 0.42), go: 'c1' },
          { text: '[slide the press credential across the counter]',
            req: R('composure', 0.22), go: 'c1b' },
          { text: 'Your tongue is doing something and I want it on record.',
            req: R('nerve', 0.72), go: 'cBad' },
          { text: '[say nothing. hold eye contact.]', go: 'cStare' },
        ],
      },
      c1: {
        who: 'SWAN — NIGHT DESK',
        line: 'Room 1850. The elevators are past the floor. The bellman is — unavailable tonight.',
        time: 7,
        options: [
          { text: 'Much obliged.', effect: { complete: 'checkin', give: 'key', fear: -0.12 }, end: true },
          { text: 'Unavailable how?', go: 'c2' },
        ],
      },
      c1b: {
        who: 'SWAN — NIGHT DESK',
        line: 'A journalist. Of course. It’s always a journalist at this hour.',
        time: 7,
        options: [
          { text: '[nod slowly until she stops talking]',
            effect: { complete: 'checkin', give: 'key', loathing: 0.04 }, end: true },
          { text: 'I’m here about the drug convention.', go: 'c2' },
        ],
      },
      c2: {
        who: 'SWAN — NIGHT DESK',
        line: 'Sir, there are four hundred district attorneys in this building. Please take your key.',
        time: 6,
        options: [
          { text: '[take the key]', effect: { complete: 'checkin', give: 'key' }, end: true },
        ],
      },
      cBad: {
        who: 'SWAN — NIGHT DESK',
        line: 'I am going to pretend you said something else. Do you want the room or not.',
        time: 6,
        options: [
          { text: 'I want the room.', effect: { complete: 'checkin', give: 'key', loathing: 0.14 }, end: true },
          { text: 'I want to know what you are.', effect: { fear: 0.3, loathing: 0.22 }, end: true,
            say: 'She reaches, very slowly, for a telephone.' },
        ],
      },
      cStare: {
        who: 'SWAN — NIGHT DESK',
        line: '… Sir. Sir. There is a line behind you.',
        time: 5,
        options: [
          { text: 'Duke. Reservation.', req: R('composure', 0.3), go: 'c1' },
          { text: '[keep staring]', effect: { fear: 0.26, loathing: 0.1 }, end: true,
            say: 'Somewhere behind you, the line begins to discuss you.' },
        ],
      },
    },
  },

  /* -------------------------------------------------- dealer */
  dealer: {
    start: 'd0',
    nodes: {
      d0: {
        who: 'THE MAN AT THE BAR',
        line: 'You’re not police. Police stand better than that. So what is it.',
        time: 9,
        options: [
          // Pitched for one line of cocaine taken in the lobby, AFTER the walk
          // and after being spoken to has pushed fear up: that lands at about
          // 0.50-0.55, and at 0.50 the gate was shutting mid-conversation.
          { text: 'Adrenochrome. I know what you keep in the ice.',
            req: R('nerve', 0.44), go: 'd1', unlessDone: 'score' },
          { text: 'I have cash and I have no patience left.',
            req: R('nerve', 0.60), go: 'd1', effect: { loathing: 0.05 }, unlessDone: 'score' },
          { text: 'Just a drink. Whatever’s nearest.',
            effect: { giveItem: 'tequila', fear: -0.06 }, end: true,
            say: 'He pours without looking at you. It is warm.' },
          { text: '… I’ve forgotten. I had it a second ago.',
            effect: { fear: 0.18 }, end: true },
        ],
      },
      d1: {
        who: 'THE MAN AT THE BAR',
        line: 'You understand where it comes from. It isn’t brewed. It comes out of a person, and the person has to be having a bad time.',
        time: 10,
        options: [
          { text: 'I understand.', go: 'd2' },
          { text: 'I’d rather not think about it.', go: 'd2', effect: { fear: 0.08 } },
          { text: 'Then I don’t want it.', end: true, say: 'He shrugs and the ice goes back under the bar.' },
        ],
      },
      d2: {
        who: 'THE MAN AT THE BAR',
        line: 'Take it. And listen — your lawyer came through here dragging a briefcase and left without it. It’s still out on the floor. You won’t see it with those eyes.',
        time: 10,
        options: [
          { text: 'What eyes should I be using?',
            effect: { complete: 'score', giveItem: 'adrenochrome', hint: 'briefcase' }, end: true,
            say: 'He taps the purple vial in your pocket and says nothing else.' },
          { text: '[take it and go]',
            effect: { complete: 'score', giveItem: 'adrenochrome', hint: 'briefcase' }, end: true },
        ],
      },
    },
  },

  /* ------------------------------------------------ attorney */
  attorney: {
    start: 'a0',
    nodes: {
      a0: {
        who: 'YOUR ATTORNEY',
        line: 'There you are. I’ve been explaining to the carpet that we are professionals. It isn’t listening.',
        time: 10,
        options: [
          { text: 'Where is the briefcase.', go: 'a1' },
          { text: 'Are you all right.', go: 'a2' },
          { text: '[take the vial out of his jacket]', once: true,
            req: R('nerve', 0.45), effect: { giveItem: 'mescaline', loathing: 0.05 }, end: true,
            say: 'He does not notice. He is negotiating with the floor.' },
          { text: '[leave him to it]', end: true },
        ],
      },
      a1: {
        who: 'YOUR ATTORNEY',
        line: 'On the floor. I set it down and it stopped existing, which is a legal grey area. You’ll see it when your eyes are correct.',
        time: 9,
        options: [
          { text: 'Correct how.', go: 'a3' },
          { text: 'That isn’t an answer.', effect: { loathing: 0.05 }, end: true },
        ],
      },
      a2: {
        who: 'YOUR ATTORNEY',
        line: 'I am tremendous. Here. You look like a man who needs the edge taken off before he talks to anyone.',
        time: 8,
        options: [
          { text: '[accept]', once: true, effect: { giveItem: 'tequila', fear: -0.1 }, end: true },
          { text: '[decline]', end: true },
        ],
      },
      a3: {
        who: 'YOUR ATTORNEY',
        line: 'Purple, my friend. The purple one. Take it standing on the casino floor and look down.',
        time: 9,
        options: [
          { text: 'Give me the purple one.', once: true,
            effect: { giveItem: 'mescaline', hint: 'briefcase' }, end: true },
          // the way out once the vial above is spent, or it is a dead end
          { text: '[nod slowly, and go]', end: true },
        ],
      },
    },
  },

  /* ------------------------------------ ACT TWO: the bath
     He is in the tub with the tape machine and he has worked out how he
     wants the night to finish. The film's answer to this is a grapefruit,
     and so is ours -- but you have to be steady enough to think of it. */
  gonzo: {
    start: 'g0',
    nodes: {
      g0: {
        who: 'YOUR ATTORNEY',
        line: 'There you are. Listen. When the song peaks -- and you will know the '
            + 'moment -- I want you to throw that machine into the tub with me.',
        time: 11,
        options: [
          { text: 'I am not doing that.', go: 'g1' },
          { text: 'Why the machine.', go: 'g2' },
          { text: '[pick up the grapefruit instead]',
            req: R('nerve', 0.40), go: 'g3' },
          { text: '[unplug it at the wall and say nothing]',
            req: R('composure', 0.55), go: 'g4' },
        ],
      },
      g1: {
        who: 'YOUR ATTORNEY',
        line: 'You are a coward and a bad journalist. Fine. Then at least throw '
            + 'something. The moment is coming whether you participate or not.',
        time: 9,
        options: [
          { text: '[the grapefruit]', req: R('nerve', 0.40), go: 'g3' },
          { text: '[the machine. give him what he asked for]', go: 'gBad' },
          { text: '[walk out and shut the door]', go: 'g5' },
        ],
      },
      g2: {
        who: 'YOUR ATTORNEY',
        line: 'Because it has the whole trip on it and I would like the whole trip '
            + 'to go at once. Tidy. Journalistically tidy.',
        time: 8,
        options: [
          { text: 'That is the story you are asking me to drown.', go: 'g1' },
          { text: '[the grapefruit]', req: R('nerve', 0.40), go: 'g3' },
        ],
      },
      g3: {
        who: 'YOUR ATTORNEY',
        line: 'It hits the water like a body and he goes under and comes up howling '
            + 'and entirely alive, and the tape is still dry on the cistern.',
        time: 9,
        options: [
          { text: '[leave him laughing]',
            effect: { complete: 'bath', hint: 'maid', flag: 'gonzoSafe',
                      fear: -0.15, loathing: -0.08 }, end: true,
            say: 'Somebody knocks. Twice, politely, which is worse.' },
        ],
      },
      g4: {
        who: 'YOUR ATTORNEY',
        line: '... You have taken the moment away from me. I want that on record. '
            + 'I want it on the record that you took the moment.',
        time: 8,
        options: [
          { text: 'It is on the record. It is on the tape you wanted drowned.',
            effect: { complete: 'bath', hint: 'maid', flag: 'gonzoSafe',
                      fear: -0.10 }, end: true,
            say: 'Somebody knocks. Twice, politely, which is worse.' },
        ],
      },
      g5: {
        who: 'YOUR ATTORNEY',
        line: 'Shut it then. Shut it and listen to me not stop.',
        time: 6,
        options: [
          { text: '[shut the door]',
            effect: { complete: 'bath', hint: 'maid', flag: 'gonzoSafe',
                      loathing: 0.10 }, end: true,
            say: 'Somebody knocks. Twice, politely, which is worse.' },
        ],
      },
      gBad: {
        who: 'YOUR ATTORNEY',
        line: 'The machine goes in. Everything stops. Then he sits up out of the water '
            + 'holding it and looks at you like you have finally told him the truth.',
        time: 10,
        options: [
          { text: '[say nothing]',
            effect: { complete: 'bath', hint: 'maid', loathing: 0.30, fear: 0.20 },
            end: true,
            say: 'The tape is dead. Two days of it. Somebody knocks at the door.' },
        ],
      },
    },
  },

  /* ------------------------------------ ACT TWO: the door
     The film's way out of this is to claim to be police. It works on
     nerve, not on truth. */
  maid: {
    start: 'm0',
    nodes: {
      m0: {
        who: 'HOUSEKEEPING',
        line: 'Sir -- I am so sorry -- the door was -- is everything all right in here.',
        time: 9,
        options: [
          { text: 'We are police officers. This is a narcotics investigation.',
            req: R('nerve', 0.52), go: 'm1' },
          { text: 'Everything is fine. Come back in the morning.',
            req: R('composure', 0.50), go: 'm2' },
          { text: 'Does that look all right to you?', go: 'm3' },
          { text: '[shut the door]', go: 'm3' },
        ],
      },
      m1: {
        who: 'HOUSEKEEPING',
        line: 'Oh -- oh, thank God. There has been a man in the pool all week and '
            + 'nobody will say anything about it. Should I be writing things down?',
        time: 10,
        options: [
          { text: 'Write everything down. Tell nobody.',
            effect: { complete: 'maid', hint: 'story', fear: -0.12 }, end: true,
            say: 'She goes away happy. It is the only clean thing that happens tonight.' },
          { text: 'No. Go home.',
            effect: { complete: 'maid', hint: 'story' }, end: true,
            say: 'She backs out into the corridor and does not stop backing.' },
        ],
      },
      m2: {
        who: 'HOUSEKEEPING',
        line: 'Of course. Of course. I will -- yes. Good night, sir.',
        time: 6,
        options: [
          { text: '[shut the door gently]',
            effect: { complete: 'maid', hint: 'story' }, end: true,
            say: 'She goes. The corridor swallows her, and the door clicks shut.' },
        ],
      },
      m3: {
        who: 'HOUSEKEEPING',
        line: 'She looks past you at the room for a long time and then decides, very '
            + 'carefully, that she has seen nothing at all.',
        time: 8,
        options: [
          { text: '[let her go]',
            effect: { complete: 'maid', hint: 'story', loathing: 0.12, fear: 0.10 },
            end: true, say: 'She walks away down the corridor, very fast, not running.' },
        ],
      },
    },
  },

  /* ------------------------------------------------ security */
  security: {
    start: 's0',
    nodes: {
      s0: {
        who: 'HOUSE SECURITY',
        line: 'Guests only past this point. Room number.',
        time: 8,
        options: [
          { text: 'Eighteen fifty.', req: R('composure', 0.38), needs: 'key', go: 's1' },
          { text: '[hold up the key]', needs: 'key', go: 's1' },
          { text: 'Do you have any idea who I am.',
            req: R('nerve', 0.82), effect: { loathing: 0.18 }, go: 's1' },
          { text: 'Eighteen — eighteen something. It’s written down.',
            effect: { fear: 0.22, loathing: 0.06 }, end: true,
            say: 'He does not move aside.' },
        ],
      },
      s1: {
        who: 'HOUSE SECURITY',
        line: 'Elevators are behind me. Keep your hands where the cameras can find them.',
        time: 6,
        options: [
          { text: '[go]', effect: { complete: 'security' }, end: true },
        ],
      },
    },
  },

  /* ------------------------------------ ACT THREE: the payphone
     The film's punchline is that the escape is cancelled by a phone call
     and he goes straight back into it. You get to decide whether you do,
     and the game does not treat refusing as losing -- it just costs you
     the story you were about to be handed. */
  phone: {
    start: 'p0',
    nodes: {
      p0: {
        who: 'YOUR ATTORNEY',
        line: 'How did I find you. I am your attorney. Listen -- are you sitting '
            + 'down. You have a suite booked starting tonight. Same hotel. They never '
            + 'even noticed you left.',
        time: 11,
        options: [
          { text: 'I am eleven hundred miles into leaving.', go: 'p1' },
          { text: 'Booked by whom.', go: 'p1' },
          { text: '[hang up]', go: 'pOut' },
        ],
      },
      p1: {
        who: 'YOUR ATTORNEY',
        line: 'The National District Attorneys Association. Four days. A seminar on '
            + 'narcotics and dangerous drugs. They want a journalist in the room.',
        time: 10,
        options: [
          { text: 'They want a journalist in THAT room.', go: 'p2' },
          { text: 'No.', go: 'pOut' },
        ],
      },
      p2: {
        who: 'YOUR ATTORNEY',
        line: 'Four hundred cops learning what a marijuana looks like, and us in the '
            + 'middle of it on expenses. You will never get this close again.',
        time: 10,
        options: [
          { text: '[turn the car around]',
            effect: { loathing: 0.1 }, end: true, act: 'back' },
          { text: '[put the phone down and keep driving]', go: 'pOut' },
        ],
      },
      pOut: {
        who: 'YOUR ATTORNEY',
        line: 'You are making a mistake. You are making it slowly and on a public '
            + 'telephone. -- Are you still there.',
        time: 8,
        options: [
          { text: '[hang up]', end: true, act: 'away' },
          { text: 'All right. All right. Which ballroom.',
            effect: { loathing: 0.1 }, end: true, act: 'back' },
        ],
      },
    },
  },

  /* ------------------------------------------ out front
     The film's parking attendant, who takes the car off you on the way in
     and says the one thing you do not want to hear from anybody. */
  valet: {
    start: 'v0',
    nodes: {
      v0: {
        who: 'THE PARKING ATTENDANT',
        line: 'The red one on the kerb. That is yours. I parked around it, sir. '
            + 'I’ll remember your face.',
        time: 8,
        options: [
          { text: '[take the ticket]', end: true, say: 'He watches you all the way to the car.' },
          { text: 'Remember it quietly.', effect: { fear: 0.05 }, end: true },
          { text: 'Do not remember anything. That is what the tip is for.',
            req: R('nerve', 0.45), effect: { fear: -0.05 }, end: true,
            say: 'He takes the tip and his face goes carefully empty.' },
        ],
      },
    },
  },

  /* ------------------------------------ ACT FOUR: the table
     A name on a card, pinned to your lapel, in a room full of people whose
     whole job is checking names. Every way through it gets you a badge; how
     you get it is what it costs. */
  registrar: {
    start: 'r0',
    nodes: {
      r0: {
        who: 'REGISTRATION',
        line: 'Name and jurisdiction, please. The badge goes on the lapel, sir, '
            + 'not the forehead.',
        time: 9,
        options: [
          { text: 'Duke. Los Angeles County. Special investigations.',
            req: R('composure', 0.45), go: 'r1' },
          { text: 'Put down "Narcotics." Just the one word.',
            req: R('nerve', 0.50), go: 'r2' },
          { text: '[nod at your attorney] I am with him.', go: 'r3' },
          { text: '[take a badge off the table while she is writing]', go: 'rGrab' },
        ],
      },
      r1: {
        who: 'REGISTRATION',
        line: 'Los Angeles. You people must be seeing all of it out there. Enjoy '
            + 'the keynote -- it is standing room only at the back.',
        time: 7,
        options: [
          { text: '[pin it on straight]',
            effect: { complete: 'badge', fear: -0.08 }, end: true,
            say: 'RAOUL DUKE — L.A. COUNTY. It is the most official you have ever looked.' },
        ],
      },
      r2: {
        who: 'REGISTRATION',
        line: 'She writes NARCOTICS in capitals, looks at it, and hands it over '
            + 'with a small respectful nod, as if it were a rank.',
        time: 7,
        options: [
          { text: '[salute, slightly]',
            effect: { complete: 'badge', loathing: 0.03 }, end: true },
        ],
      },
      r3: {
        who: 'REGISTRATION',
        line: 'And he is -- ? He says he is your attorney. Your attorney says a '
            + 'great many things. Here. Just -- here.',
        time: 7,
        options: [
          { text: '[take it before she changes her mind]',
            effect: { complete: 'badge', loathing: 0.05 }, end: true,
            say: 'The badge says VISITOR. It will have to do.' },
        ],
      },
      rGrab: {
        who: 'REGISTRATION',
        line: 'You come away with a badge. It belongs to a man called Harold from '
            + 'Tulsa. She is still writing and does not look up.',
        time: 7,
        options: [
          { text: '[become Harold]',
            effect: { complete: 'badge', fear: 0.10, loathing: 0.04 }, end: true,
            say: 'For the rest of the morning you are an assistant district attorney from Oklahoma.' },
        ],
      },
    },
  },

  /* your attorney in the foyer, before the keynote, with supplies */
  gonzo4: {
    start: 'z0',
    nodes: {
      z0: {
        who: 'YOUR ATTORNEY',
        line: 'Look at them. Four hundred cops and not one of them has ever been '
            + 'high. I checked the badges. You are going to want something for the '
            + 'keynote -- it is ninety minutes.',
        time: 11,
        options: [
          { text: '[take the downers he is holding out]', once: true,
            effect: { giveItem: 'downers' }, end: true,
            say: 'He presses them into your palm like a man tipping a doorman.' },
          { text: '[take the little brown bottle]', once: true,
            effect: { giveItem: 'ether' }, end: true,
            say: 'It smells like a hospital corridor and it is warm from his pocket.' },
          { text: 'Ninety minutes?', go: 'z1' },
          { text: '[leave him to the badges]', end: true },
        ],
      },
      z1: {
        who: 'YOUR ATTORNEY',
        line: 'Ninety minutes on the drug menace, by a man who has read about it. '
            + 'Sit on the aisle. If I stand up, you stand up.',
        time: 8,
        options: [
          { text: 'Where will you be sitting.', go: 'z2' },
          { text: '[nod]', end: true },
        ],
      },
      z2: {
        who: 'YOUR ATTORNEY',
        line: 'At the back, by the coffee. There is a man from Georgia there who '
            + 'wants to know what is really going on in California, and I am '
            + 'going to tell him.',
        time: 8,
        options: [{ text: '[go and find your seat]', end: true }],
      },
    },
  },

  /* ...and after, at the urn, having set the whole thing up */
  gonzo5: {
    start: 'y0',
    nodes: {
      y0: {
        who: 'YOUR ATTORNEY',
        line: 'He is ready. I have told him nothing. I have only implied. Go on -- '
            + 'he wants to hear it from a man who has seen it.',
        time: 8,
        options: [
          { text: '[turn to the delegate]', end: true },
          { text: '[take the amyls he is palming]', once: true,
            effect: { giveItem: 'amyls' }, end: true,
            say: 'He hands them over in plain view of the urn. Nobody at the urn has any idea what they just saw.' },
        ],
      },
    },
  },

  /* ------------------------------------ ACT FOUR: the question
     The keynote speaker wants a volunteer, and he has picked the aisle. The
     joke is that the right answer is the dangerous one: nobody who knows
     what it is called should be sitting in this room. */
  lecturer: {
    start: 'q0',
    nodes: {
      q0: {
        who: 'DR. BUMQUIST',
        line: 'You, sir. On the aisle, with the -- yes. You look like a man who has been '
            + 'in the field. Why do you suppose they call it a roach?',
        time: 9,
        options: [
          { text: 'Because it looks like a cockroach?', go: 'q2' },
          { text: 'It does not look like anything. It is just the word for it.',
            req: R('composure', 0.40), go: 'q1' },
          { text: 'I would have to see one in person. For the record.',
            req: R('nerve', 0.50), go: 'q3' },
          { text: '[shrug like a man who has never seen one]', go: 'q2b' },
        ],
      },
      q1: {
        who: 'DR. BUMQUIST',
        line: 'A murmur. Four hundred heads turn a degree toward you. "That is a very '
            + 'interesting answer," he says slowly, and writes something down.',
        time: 7,
        options: [
          { text: '[sink into the chair]', effect: { fear: 0.14, loathing: 0.04 }, end: true },
        ],
      },
      q2: {
        who: 'DR. BUMQUIST',
        line: 'Exactly right. Exactly. It resembles a cockroach. That, gentlemen, is the '
            + 'kind of thinking we need in this room.',
        time: 7,
        options: [
          { text: '[nod gravely, like a man who has seen a great many cockroaches]',
            effect: { fear: -0.10, loathing: 0.03 }, end: true },
        ],
      },
      q2b: {
        who: 'DR. BUMQUIST',
        line: 'He answers for you: because it looks like a cockroach. Four hundred pens '
            + 'write the word down at once.',
        time: 7,
        options: [
          { text: '[write it down too]', effect: { fear: -0.06 }, end: true },
        ],
      },
      q3: {
        who: 'DR. BUMQUIST',
        line: 'Laughter -- the good kind. He points at you like you are in on it with him, '
            + 'and for about a second, you are.',
        time: 7,
        options: [
          { text: '[take the laugh]', effect: { fear: -0.16 }, end: true },
        ],
      },
    },
  },

  /* ------------------------------------ ACT FOUR: the delegate from Georgia
     The book's best joke: two men full of chemicals telling a district
     attorney that the real drug fiends are out there, and worse than he
     imagines. You can play it all the way, or not at all. Every path closes
     the errand; only one of them is worth it. */
  georgia: {
    start: 'e0',
    nodes: {
      e0: {
        who: 'THE DELEGATE FROM GEORGIA',
        line: 'You boys come in from the coast? Your friend here says you have seen '
            + 'some things out there. Things they do not put in the literature.',
        time: 10,
        options: [
          { text: 'Worse than the literature. They come in off the desert at night.',
            req: R('nerve', 0.46), go: 'e1' },
          { text: 'It is mostly kids. Mostly harmless.',
            req: R('composure', 0.45), go: 'eCalm' },
          { text: '[let your attorney tell it]', go: 'eGonzo' },
          { text: 'My attorney exaggerates. It is a medical condition.', go: 'eDry' },
        ],
      },
      e1: {
        who: 'THE DELEGATE FROM GEORGIA',
        line: 'Off the desert? Who does?',
        time: 8,
        options: [
          { text: 'Cults. Dope cults. Nobody in Sacramento will say the word out loud.',
            go: 'e2' },
          { text: 'I have said too much. Forget the desert.',
            effect: { complete: 'georgia', fear: 0.08 }, end: true,
            say: 'He looks at you as if you have left a door open in his house.' },
        ],
      },
      e2: {
        who: 'THE DELEGATE FROM GEORGIA',
        line: 'Lord have mercy. What is it they want?',
        time: 8,
        options: [
          { text: 'Hearts. They take them in the parking lots of the good hotels. Like this one.',
            req: R('nerve', 0.52), go: 'e3' },
          { text: 'Mostly they want to be left alone.', go: 'eCalm' },
        ],
      },
      e3: {
        who: 'THE DELEGATE FROM GEORGIA',
        line: 'He puts his coffee down very carefully on the wrong side of the saucer, '
            + 'and looks out through the glass at the parking lot for a long, long time.',
        time: 9,
        options: [
          { text: '[say nothing. let it land.]',
            effect: { complete: 'georgia', flag: 'georgiaSpooked', fear: -0.20, loathing: -0.10 },
            end: true,
            say: 'He says he has to go and call his wife. Behind him your attorney is '
               + 'shaking with the effort of not laughing.' },
        ],
      },
      eGonzo: {
        who: 'THE DELEGATE FROM GEORGIA',
        line: 'Your attorney leans in: "Tell him about the heads." The delegate looks '
            + 'from him to you and back, waiting.',
        time: 9,
        options: [
          { text: 'The heads are true. I will not talk about the heads.',
            req: R('nerve', 0.40), go: 'e2' },
          { text: 'He is joking. He is a lawyer.', go: 'eDry' },
        ],
      },
      eCalm: {
        who: 'THE DELEGATE FROM GEORGIA',
        line: 'Kids. Huh. Well, that is not what they are telling us in there.',
        time: 7,
        options: [
          { text: 'They would know. They have slides.',
            effect: { complete: 'georgia', loathing: 0.04 }, end: true },
        ],
      },
      eDry: {
        who: 'THE DELEGATE FROM GEORGIA',
        line: 'He decides you are both some kind of Californian joke he is not in on, '
            + 'and turns back to the urn.',
        time: 7,
        options: [
          { text: '[let him go]', effect: { complete: 'georgia', loathing: 0.06 }, end: true },
        ],
      },
    },
  },

  /* ------------------------------------ ACT FIVE: the bill
     The same desk, the same woman, two days later. She has been on shift the
     entire time and she looks exactly the same, which you decide not to think
     about. Every option settles it; they settle it differently. */
  bill: {
    start: 'b0',
    nodes: {
      b0: {
        who: 'SWAN — THE DESK',
        line: 'Mr. Duke. You are checking out. There are some charges on 1850 -- room '
            + 'service, mostly, and there is a note here about the bathroom that I am '
            + 'not going to read aloud.',
        time: 11,
        options: [
          { text: '[pay it. all of it.]', cost: 450, go: 'bPaid' },
          { text: 'Charge it to the magazine. They are expecting it.',
            req: R('composure', 0.50), go: 'bMag' },
          { text: 'My attorney is handling the account.',
            req: R('nerve', 0.50), go: 'bAtty' },
          { text: '[walk away from the desk. do not run.]', go: 'bRun' },
        ],
      },
      bPaid: {
        who: 'SWAN — THE DESK',
        line: 'She counts it twice, slowly, the way you count something you did not '
            + 'expect to exist. "Thank you for staying with us, Mr. Duke."',
        time: 7,
        options: [{ text: '[take the receipt]',
          effect: { complete: 'bill', flag: 'billPaid', pay: 450, fear: -0.1 }, end: true }],
      },
      bMag: {
        who: 'SWAN — THE DESK',
        line: 'She writes the name of the magazine on the bill very neatly and '
            + 'underlines it twice, and you understand that somebody in an office is '
            + 'going to have a very bad morning.',
        time: 8,
        options: [{ text: '[thank her]', effect: { complete: 'bill', flag: 'billMag' }, end: true }],
      },
      bAtty: {
        who: 'SWAN — THE DESK',
        line: 'She looks past you at the glass doors. Out on the kerb your attorney is '
            + 'already in the car with the engine running, waving at nobody.',
        time: 8,
        options: [{ text: '[go and join him]',
          effect: { complete: 'bill', flag: 'billAtty', fear: 0.05 }, end: true }],
      },
      bRun: {
        who: 'SWAN — THE DESK',
        line: '"Sir. Sir --" and then nothing at all, which is somehow worse.',
        time: 6,
        options: [{ text: '[keep walking]',
          effect: { complete: 'bill', flag: 'billRun', fear: 0.18, loathing: 0.08 }, end: true,
          say: 'Behind you a telephone is lifted off its cradle, very quietly.' }],
      },
    },
  },

  /* ------------------------------ a person who is not there */
  ghost: {
    start: 'g0',
    nodes: {
      g0: {
        who: '?',
        line: 'YOU LEFT SOMETHING IN THE ROOM BEFORE YOU EVER GOT THE ROOM',
        time: 6,
        options: [
          { text: 'What did I leave.', effect: { fear: 0.26, loathing: 0.14 }, end: true,
            say: 'There was never anyone standing there.' },
          { text: '[look away. keep walking.]', effect: { fear: 0.06 }, end: true,
            say: 'Good. It was not a person.' },
        ],
      },
    },
  },
};

/* ============================================================
   TASKS
   ============================================================ */
const TASK_DEFS = [
  // stage: which list it belongs on. 'floor' the casino on the way in,
  // 'room' 1850, 'out' the casino again on the way out, 'road' the drive.
  { stage: 'floor', id: 'checkin',   text: 'Check in at the front desk. Speak like a man with a reservation.' },
  { stage: 'floor', id: 'score',     text: 'Find the man at the bar. Get what your attorney promised.' },
  { stage: 'floor', id: 'briefcase', text: 'Recover the briefcase from the casino floor.' },
  { stage: 'floor', id: 'security',  text: 'Get past house security to the elevators.' },
  { stage: 'floor', id: 'room',      text: 'Reach the elevator. Room 1850.' },
  // ---- ACT TWO. The door shuts and the trouble is already inside.
  { stage: 'room', id: 'bath',      text: 'Your attorney is in the bath. He has a request.' },
  { stage: 'room', id: 'maid',      text: 'Somebody is knocking. Get rid of them.' },
  { stage: 'room', id: 'story',     text: 'File the story. The magazine is still waiting.' },
  { stage: 'room', id: 'downstairs', text: 'Out into the hall. Take the lift back down.' },
  // ---- and out the way you came in, across the whole floor
  { stage: 'out', id: 'checkout',  text: 'Out the front doors by the desk. The car is out front.' },
  // ---- ACT THREE. Out of the city before it notices you leaving.
  { stage: 'road', id: 'drive',     text: 'Drive. Keep it between the lines until you find somewhere to stop.' },
  { stage: 'road', id: 'callback',  text: 'The payphone is ringing. Nobody knows you are here.' },
  { stage: 'road', id: 'return',    text: 'Drive back. The convention is waiting in the town you just left.' },
  // ---- ACT FOUR. The District Attorneys, in the ballroom off the east wing.
  { stage: 'convention', id: 'badge',   text: 'Register at the table. You are a delegate now.' },
  { stage: 'convention', id: 'seminar', text: 'Find your seat on the aisle. Sit through the keynote on dangerous drugs.' },
  { stage: 'convention', id: 'georgia', text: 'Your attorney has found a delegate from Georgia at the coffee urn.' },
  { stage: 'convention', id: 'walkout', text: 'Out through the foyer doors, before anybody checks a badge twice.' },
  // ---- ACT FIVE. The bill, the car, and west.
  { stage: 'last', id: 'bill',     text: 'The desk has your bill. Settle it, one way or another.' },
  { stage: 'last', id: 'westward', text: 'The car is out front. Drive west, and do not stop for the telephone.' },
];

/* ACT FOUR's keynote, staged the way the film stages it: a moderator, then
   Dr. Bumquist at the lectern walking four hundred prosecutors through the
   drug culture's vocabulary -- the roach that is supposed to look like a
   cockroach -- with your own voice in your head cutting across him. The
   words are this game's, not the screenplay's.

   One line per slide, each on the screen for as long as it is on the
   subtitle. A slide that names a drug is a problem only if the drug is in
   you at the time: he is not looking at you, but it feels exactly as if he
   is. An "ask" stops the lecture for a question from the floor. */
const DOC = 'DR. BUMQUIST', YOU = 'YOU, TO YOURSELF';
const LECTURE = [
  { t: 8, slide: 'title', who: 'THE MODERATOR',
    line: 'Gentlemen. Our keynote this morning has spent more time studying the drug '
        + 'problem than any man in the country. Please welcome Dr. Bumquist.' },
  { t: 8, slide: 'title', who: DOC,
    line: 'Thank you. Before you can fight the drug culture you have to be able to '
        + 'understand its language, and this morning I am going to teach you some of it.' },
  { t: 8, slide: 'grass', who: DOC,
    line: 'Marihuana. They call it grass. Tea. Weed. Pot. It is rolled and smoked like '
        + 'a cigarette, and it is passed from hand to hand, which is how it spreads.' },
  { t: 8, slide: 'roach', who: DOC, ask: 'lecturer',
    line: 'Now. When one of these is smoked all the way down, the little end that is '
        + 'left over is called a roach. Can anybody here tell me why?' },
  { t: 8, slide: 'roach', who: YOU,
    line: 'A cockroach. You would have to be very deep into the acid before that thing '
        + 'looked like a cockroach. And these are the men who are going to catch us.' },
  { t: 8, slide: 'acid', who: DOC,
    line: 'LSD. The user sees colours. Faces in the walls. He may come to believe he can '
        + 'fly. He cannot fly. I want that clearly understood by everyone in this room.' },
  { t: 7, slide: 'acid', who: YOU,
    line: 'At the front of the hall the carpet has begun, very politely, to breathe.' },
  { t: 8, slide: 'cocaine', who: DOC,
    line: 'Cocaine. Expensive, which means that for the moment it is chiefly a problem '
        + 'for the entertainment industry. That moment is ending.' },
  { t: 8, slide: 'ether', who: DOC,
    line: 'Ether. A hospital anaesthetic. There are people who breathe it for pleasure, '
        + 'and I will be frank with you, gentlemen: we do not know why.' },
  { t: 8, slide: 'ether', who: YOU,
    line: 'Nobody in this room has the faintest idea what is going on out there. You could '
        + 'stand up and do the ether right here in the aisle and they would take notes.' },
  { t: 8, slide: 'adrenochrome', who: DOC,
    line: 'There are rumours of a drug extracted from the human adrenal gland. Our own '
        + 'laboratory assures me that it does not exist.' },
  { t: 7, slide: 'end', who: DOC,
    line: 'Thank you. Coffee at the back of the hall. The film on heroin begins at eleven.' },
];

/* The case is ten unlabelled things and the gates ask for stats, so a
   player with NERVE 0/3 in front of them has no way of knowing that the
   answer is the white one. This reads the dominant effect straight off
   the substance's own stat block, so it cannot drift out of date. */
function billing(S) {
  const st = S.stat || {};
  const cand = [
    ['NERVE', st.nerve || 0],
    ['SIGHT', st.perception || 0],
    ['CALM', st.fearOff || 0],
    ['POISE', st.composure || 0],
  ];
  cand.sort((a, b) => b[1] - a[1]);
  const best = cand[0];
  const cost = (st.motorLoss || 0) > 0.4 ? ' / LEGS'
    : (st.composure || 0) < -0.5 ? ' / WORDS' : '';
  return best[1] < 0.15 ? 'TROUBLE' : best[0] + cost;
}

// how steady you have to be to write two thousand words
export const STORY_COMPOSURE = 0.62;

/* What your own head offers you to say when you are seeing things. Each
   one looks like any other option on the list and each one goes badly. */
const CRAZY = [
  { text: 'Your face is doing the eel thing again. Just so you know.',
    say: 'Nobody says anything for a long, long time.' },
  { text: 'There is a lizard in your collar and it is listening to us.',
    say: 'They take one careful step back from you.' },
  { text: 'We can’t stop here. This is bat country.',
    say: 'You hear yourself say it and it is already too late.' },
  { text: 'I need you to tell me honestly whether the carpet is breathing.',
    say: 'They look down at the carpet, then at you, and decide.' },
  { text: 'I have a doctor’s note for all of this. It is in the car.',
    say: 'Somebody, somewhere behind you, laughs once.' },
  { text: 'Is that blood? That is not a question, that is a warning.',
    say: 'Their hand moves toward a telephone.' },
].map((c) => ({ ...c, crazy: true, end: true,
  effect: { fear: 0.22, loathing: 0.10 } }));

const GARBLE_GLYPHS = '§¤#@%&*¥Ω∆∑◊≈¬∂ƒ†‡';
const BLACKOUT_SECS = 2.4;
const ONSET_RATE = 0.42;   // how fast a dose comes up, per second
const FLASH_MS = 520;      // the blink when it lands — wall clock, not game time

/* ============================================================ */
export class Game {
  constructor(audio) {
    this.audio = audio;

    this.el = {
      hud: document.getElementById('hud'),
      meters: document.querySelectorAll('#meters .meter'),
      stats: document.querySelectorAll('#stats .stat'),
      inv: document.getElementById('inventory'),
      tasks: document.querySelector('#tasks ul'),
      tasksPanel: document.getElementById('tasks'),
      prompt: document.getElementById('prompt'),
      subtitle: document.getElementById('subtitle'),
      toasts: document.getElementById('toast-stack'),
      dialogue: document.getElementById('dialogue'),
      dWho: document.querySelector('.dlg-who'),
      dLine: document.querySelector('.dlg-line'),
      dTimer: document.querySelector('.dlg-timer'),
      dTimerBar: document.querySelector('.dlg-timer i'),
      dOpts: document.querySelector('.dlg-options'),
      reticle: document.getElementById('reticle'),
      flash: document.getElementById('flash'),
      endcard: document.getElementById('endcard'),
    };

    this._buildInventory();
    this.reset();
  }

  /* ------------------------------------------------- state */
  reset() {
    this.fear = 0.12;
    this.loathing = 0.04;
    // built from the table, so adding to the case never means editing this
    this.subs = {};
    this.pending = {};
    this.stock = {};
    for (const k of KEYS) { this.subs[k] = 0; this.pending[k] = 0; this.stock[k] = 0; }

    // what is in the trunk when the night starts
    Object.assign(this.stock, {
      grass: 2, mescaline: 1, acid: 1, cocaine: 1, uppers: 2,
      downers: 2, tequila: 3, ether: 1, amyls: 2, adrenochrome: 0,
    });

    this.tasks = TASK_DEFS.map((t) => ({ ...t, state: 'todo' }));
    this.tasks[0].state = 'active';
    this.tasks[1].state = 'active';

    this.hasKey = false;
    this.hasBriefcase = false;
    this.usedOptions = new Set();
    this.securityCleared = false;

    this.money = 200;
    this.pulls = 0;
    this.drinksBought = 0;
    this.elevatorArmed = false;
    this.blackouts = 0;
    this.crashes = 0;
    this._crashing = false;
    this.over = false;
    this.won = false;
    this.act = 1;            // 1 = the casino floor, 2 = room 1850, 3 = the road, either way
    this.leaving = false;    // act 1 again, on the way out
    this.pendingReturn = false;
    this.gonzoSafe = false;
    this.lecture = null;     // act four's keynote, while you are sitting through it
    this.finale = false;     // act five: the lobby, the bill and the road west
    this.georgiaSpooked = false;
    this.billPaid = this.billMag = this.billAtty = this.billRun = false;
    this.elapsed = 0;
    this.dosesTaken = 0;

    this.pulse = 0;
    this._beat = 0;
    this.flash = 0;
    this._flashPeak = 0;
    this._flashEnd = 0;
    this.blackout = 1;
    this._blacking = 0;

    this.dlg = null;
    this.focus = null;
    this.crowdNear = 0;
    this.moving = false;
    this.speed = 0;

    this._subQueue = [];
    this._sayTimer = 0;

    this._renderTasks();
    this._renderInv();
    if (this.el.endcard) this.el.endcard.classList.add('hidden');
  }

  /* ------------------------------------------ derived stats */

  /** sum one field across everything currently in your blood */
  _sum(group, field) {
    let n = 0;
    for (const k of KEYS) {
      const lvl = this.subs[k];
      if (lvl > 0) n += lvl * (SUBSTANCES[k][group][field] || 0);
    }
    return n;
  }

  /** the channels the renderer and the audio engine actually see */
  get fx() {
    return {
      psych: clamp(this._sum('fx', 'psych'), 0, 1.4),
      rush: clamp(this._sum('fx', 'rush'), 0, 1.3),
      blur: clamp(this._sum('fx', 'blur'), 0, 1.2),
      dim: clamp(this._sum('fx', 'dim'), 0, 1.1),
      monster: clamp(this._sum('fx', 'monster')),
    };
  }

  /** how much the PICTURE has come apart — dim barely counts, it darkens */
  get wreck() {
    const f = this.fx;
    return clamp(f.psych * 1.0 + f.rush * 0.55 + f.blur * 0.5 + f.dim * 0.22);
  }

  /** how much of your own body you are still driving */
  get motor() { return clamp(1 - this._sum('stat', 'motorLoss')); }
  get jitter() { return clamp(this._sum('stat', 'jitter'), 0, 1.4); }
  get fearOff() { return this._sum('stat', 'fearOff'); }
  // PARANOIA is not the opposite of fearOff. A drug can take the edge off
  // a man standing alone and still make a room full of people unbearable:
  // that is the whole character of cannabis and of a high dose of acid.
  // fearOff buys down the baseline; paranoia multiplies what other people
  // cost you. Stimulants have it too, which is why the comedown bites.
  get paranoia() { return this._sum('stat', 'paranoia'); }
  get slowClock() { return this._sum('stat', 'slowClock'); }
  get legSpeed() { return clamp(1 + this._sum('stat', 'speed'), 0.45, 1.6); }

  // Fear used to take 0.55 of nerve, which is more than a whole line of
  // cocaine gives back once you are standing near anybody. It shakes the
  // hands now; it no longer cancels the drug.
  get nerve() { return clamp(0.10 + this._sum('stat', 'nerve') - this.fear * 0.42); }
  get perception() { return clamp(0.06 + this._sum('stat', 'perception')); }
  get composure() {
    return clamp(1 + this._sum('stat', 'composure')
      - this.loathing * 0.34 - this.fear * 0.22);
  }

  /** snapshot handed to the renderer and the audio engine each frame */
  snapshot() {
    const f = this.fx;
    return {
      fear: this.fear,
      loathing: this.loathing,
      psych: f.psych, rush: f.rush, blur: f.blur, dim: f.dim, monster: f.monster,
      wreck: this.wreck,
      nerve: this.nerve,
      perception: this.perception,
      composure: this.composure,
      motor: this.motor,
      legSpeed: this.legSpeed,
      money: this.money,
      jitter: this.jitter,
      pulse: this.pulse,
      flash: this.flash,
      blackout: this.blackout,
      crowdNear: this.crowdNear,
      moving: this.moving,
      speed: this.speed,
    };
  }

  /* ================================================== frame */
  update(dt) {
    if (this.over) {
      this.pulse *= 0.9;
      this.flash *= 0.9;
      return;
    }
    this.elapsed += dt;
    // One NaN in either of these used to poison every shader and audio
    // parameter downstream, and an AudioParam throws on a non-finite value,
    // so the whole game froze on the spot. Never again, whatever the cause.
    if (!Number.isFinite(this.fear)) this.fear = 0.3;
    if (!Number.isFinite(this.loathing)) this.loathing = 0.3;

    // ---- come-up, then the long slide down ------------------
    for (const k of KEYS) {
      if (this.pending[k] > 0) {
        const rise = Math.min(this.pending[k], ONSET_RATE * dt);
        this.pending[k] -= rise;
        this.subs[k] = clamp(this.subs[k] + rise);
      }
      this.subs[k] = Math.max(0, this.subs[k] - SUBSTANCES[k].decay * dt);
    }

    const chem = this.fearOff;

    // ---- fear ----------------------------------------------
    // Fear SEEKS a level set by the situation. It is not an accumulator:
    // a man standing quietly in a lobby with nothing in him does not
    // work himself into a blackout, he just stays uneasy. Blackouts come
    // from shocks — a conversation that goes wrong, a timer running out —
    // stacked on top of a bad situation, and those bleed off again.
    let target = 0.06;
    target += 0.42 * this.crowdNear * (1 + this.paranoia);   // people are the problem,
                                                             // and some of this makes them worse
    target += 0.30 * this.loathing;            // the sourness feeds it
    if (this.dlg) target += 0.18;              // and being spoken to
    target = clamp(target - 0.62 * chem);      // chemistry buys it off

    const settle = this.fear < target ? 0.16 : 0.30;  // slow to arrive, quicker to leave
    this.fear = clamp(this.fear + (target - this.fear) * settle * dt);
    this.fearTarget = target;

    // ---- loathing -------------------------------------------
    let dL = -0.004;                            // it fades, barely
    // Except this. These were 0.022 and 0.010, and integrated over the
    // drug's life that is +1.05 loathing for one vial of adrenochrome --
    // more than the whole bar -- so the dealer's vial, the reward for the
    // second errand, was a guaranteed BAT COUNTRY about a minute after you
    // used it. Now one vial costs about half the bar, all in: frightening,
    // bats on the ceiling, survivable once. Twice is your own business.
    dL += 0.006 * this.subs.adrenochrome + 0.004 * this.subs.cocaine;
    dL += 0.012 * Math.max(0, this.fear - 0.7); // and panic sours
    this.loathing = clamp(this.loathing + dL * dt);

    // ---- heartbeat pulse for the shaders ---------------------
    const rate = 0.85 + this.fear * 2.1 + this.fx.rush * 2.2;
    this._beat += dt * rate;
    if (this._beat >= 1) { this._beat -= 1; this.pulse = 1; }
    this.pulse *= Math.pow(0.0008, dt);

    // real time, not game time: a dropped frame must not leave the
    // screen washed out white for a second and a half
    const nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.flash = this._flashEnd > nowMs
      ? this._flashPeak * Math.pow((this._flashEnd - nowMs) / FLASH_MS, 2)
      : 0;

    // ---- blackout recovery -----------------------------------
    if (this._blacking > 0) {
      this._blacking -= dt;
      const p = clamp(1 - this._blacking / BLACKOUT_SECS);
      this.blackout = p < 0.22 ? 1 - p / 0.22
                    : p < 0.62 ? 0
                    : (p - 0.62) / 0.38;
      if (this._blacking <= 0) { this.blackout = 1; this._onBlackoutEnd?.(); }
    }

    // ---- fail states ------------------------------------------
    // The worst situation the game can build on its own is 0.96 (crowded,
    // fully sour, mid-conversation), and fear only approaches its target
    // asymptotically — so crossing 0.97 always takes a shock on top.
    // The threshold is not 1.0 because the settle erodes the spike in the
    // same frame it lands, and a blackout you can never reach is a bug.
    if (this.fear >= 0.97 && this._blacking <= 0) this._blackoutNow();
    if (this.loathing >= 0.995) this._batCountry();

    // ---- dialogue clock ---------------------------------------
    if (this.dlg) {
      const slow = 1 + this.slowClock * 1.5 + this.fx.blur * 0.2;
      this.dlg.t -= dt / slow;
      const f = clamp(this.dlg.t / this.dlg.max);
      this.el.dTimerBar.style.width = (f * 100).toFixed(1) + '%';
      this.el.dTimer.classList.toggle('slow', this.slowClock > 0.25);
      if (this.dlg.t <= 0) this._dialogueTimeout();
      else if (this.elapsed - this.dlg.lastGarble > 0.28) {
        this.dlg.lastGarble = this.elapsed;
        this._paintDialogueText();
      }
    }

    if (this._sayTimer > 0) {
      this._sayTimer -= dt;
      if (this._sayTimer <= 0) this.el.subtitle.classList.add('hidden');
    }

    this._paintHUD();
  }

  /* ================================================ actions */

  /** consume a dose by substance key */
  take(kind) {
    if (this.over || this._blacking > 0) return;
    if (!this.stock[kind]) { this.audio.deny(); this.toast('NOTHING LEFT', 'bad'); return; }

    const S = SUBSTANCES[kind];
    this.stock[kind]--;
    this.dosesTaken++;
    this.pending[kind] += S.dose;
    this.loathing = clamp(this.loathing + S.loathing);
    this.fear = clamp(this.fear - (kind === 'mescaline' ? 0.05 : 0.22));

    this._flashPeak = kind === 'adrenochrome' ? 0.55 : 0.28;
    this._flashEnd = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + FLASH_MS;
    this.el.flash.style.background =
      `radial-gradient(circle at 50% 50%, ${S.color}cc, transparent 70%)`;
    this.el.flash.animate(
      [{ opacity: 0.85 }, { opacity: 0 }],
      { duration: kind === 'adrenochrome' ? 1400 : 800, easing: 'ease-out' }
    );

    this.audio.dose(kind);
    this.toast(S.name, kind === 'adrenochrome' ? 'bad' : 'info');

    const card = this.el.inv.querySelector(`.vial[data-k="${kind}"]`);
    if (card) { card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop'); }

    this._renderInv();
  }

  give(what) {
    if (what === 'key') {
      if (this.hasKey) return;   // it was toasting twice: effect AND completeTask
      this.hasKey = true;
      this.toast('ROOM 1850 — KEY', 'good');
    }
  }

  /* ================================= the floor, as a floor */

  /**
   * One pull. The maths is a real slot: about a six percent house
   * edge, so you can grind a while and you will still lose in the end.
   * A jackpot is loud, and being looked at costs you.
   */
  gamble(stake = 5) {
    if (this.over || this.dlg) return null;
    if (this.money < stake) { this.audio.deny(); this.toast('NO MONEY', 'bad'); return null; }
    this.money -= stake;

    const roll = Math.random();
    let mult = 0, label = 'NOTHING';
    if (roll > 0.995) { mult = 60; label = 'JACKPOT'; }
    else if (roll > 0.961) { mult = 10; label = 'A REAL ONE'; }
    else if (roll > 0.861) { mult = 3; label = 'SMALL'; }

    const won = stake * mult;
    this.money += won;
    this.pulls++;

    if (mult >= 60) {
      this.audio.good();
      this.toast('JACKPOT  +$' + won, 'good');
      // every head on the floor turns toward the noise
      this.fear = clamp(this.fear + 0.15);
      this.loathing = clamp(this.loathing - 0.05);
      this.say('Bells. Lights. Four hundred people deciding who you are.');
    } else if (mult) {
      this.audio.pickup();
      this.toast('+$' + won, 'good');
    } else {
      this.audio.deny();
    }
    this._paintHUD();
    return { mult, won, label };
  }

  /** a drink, bought like a normal person, from a normal bar */
  buyDrink(kind = 'tequila') {
    if (this.over || this.dlg) return false;
    const S = SUBSTANCES[kind];
    if (this.money < S.price) { this.audio.deny(); this.toast('NO MONEY', 'bad'); return false; }
    this.money -= S.price;
    this.giveItem(kind);
    this.drinksBought++;
    this._paintHUD();
    return true;
  }

  giveItem(kind) {
    this.stock[kind] = (this.stock[kind] || 0) + 1;
    this.audio.pickup();
    this.toast('+1 ' + SUBSTANCES[kind].name, 'good');
    this._renderInv();
  }

  takeBriefcase() {
    if (this.hasBriefcase) return;
    this.hasBriefcase = true;
    this.audio.good();
    this.toast('THE BRIEFCASE', 'good');
    this.completeTask('briefcase');
  }

  /* -------------------------------------------------- tasks */
  completeTask(id) {
    const t = this.tasks.find((x) => x.id === id);
    if (!t || t.state === 'done') return;
    t.state = 'done';
    this.audio.good();
    this.toast('ERRAND COMPLETE', 'good');

    if (id === 'checkin') this.give('key');   // no-op if the option already handed it over
    if (id === 'score') this.activate('briefcase');
    if (id === 'briefcase') this.activate('security');
    if (id === 'security') { this.securityCleared = true; this.activate('room'); }
    if (id === 'badge') this.activate('seminar');
    if (id === 'seminar') this.activate('georgia');
    if (id === 'georgia') this.activate('walkout');
    if (id === 'bill') this.activate('westward');

    this._renderTasks();
  }

  activate(id) {
    const t = this.tasks.find((x) => x.id === id);
    if (t && t.state === 'todo') t.state = 'active';
    this._renderTasks();
  }

  taskState(id) { return this.tasks.find((x) => x.id === id)?.state; }

  get stage() {
    if (this.finale) return 'last';
    return this.act === 2 ? 'room' : this.act === 3 ? 'road' : this.act === 4 ? 'convention'
      : this.leaving ? 'out' : 'floor';
  }

  /* ===================================================== dialogue */

  openDialogue(who) {
    const tree = DIALOGUE[who];
    if (!tree || this.dlg) return false;
    this.dlg = { who, node: null, t: 0, max: 1, lastGarble: 0 };
    this._goto(tree.start);
    this.el.dialogue.classList.remove('hidden');
    this.el.prompt.classList.add('hidden');
    return true;
  }

  closeDialogue() {
    this.dlg = null;
    this.el.dialogue.classList.add('hidden');
  }

  _goto(id) {
    const tree = DIALOGUE[this.dlg.who];
    const node = tree.nodes[id];
    this.dlg.node = node;
    // the harder the words are to read, the longer you get to read them
    let t = node.time * (1 + 0.75 * this.garbleAmount);
    // A node with ONE way out of it is a beat you acknowledge, not a
    // decision made under pressure, so it does not run a clock. Security's
    // last node was exactly this: one option, six seconds. A wrecked player
    // -- which by the fourth errand is the intended state -- timed out on
    // it, took the fear penalty, and had to start the whole conversation
    // again in worse shape. That is a trap, not a difficulty.
    // What is actually on offer this time: the node's own lines, plus --
    // only while you are seeing things -- one that your own head supplies,
    // which reads exactly like the others and is never a good idea.
    const opts = node.options.slice();
    const tripping = this.fx.psych > 0.3 || this.fx.monster > 0.2;
    if (tripping && opts.length < 4 && !node.options.some((o) => o.act)) {
      opts.push(CRAZY[(Math.random() * CRAZY.length) | 0]);
    }
    // ...and in no particular order. The ones you have earned used to sit in
    // their own colour with the stat printed next to them, which told you
    // the answer; and they were always in the same slot, so you could learn
    // "it's 2" instead of reading what you were about to say.
    const order = opts.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [order[i], order[j]] = [order[j], order[i]];
    }
    this.dlg.opts = order.map((i) => opts[i]);
    const ways = this.dlg.opts.filter((o) => this._optionAvailable(o)).length;
    if (ways <= 1) t = 1e6;
    this.dlg.t = t;
    this.dlg.max = t;
    this.dlg.lastGarble = 0;
    this.el.dWho.textContent = node.who;
    this._paintDialogueText();
  }

  /** how badly the words come apart right now */
  get garbleAmount() {
    return clamp((0.55 - this.composure) / 0.55) * 0.72;
  }

  /**
   * The line has to stay guessable or the choice is a coin flip, so:
   * word shape survives (first two letters and the last one), short
   * words survive whole, and punctuation never scrambles.
   */
  _garble(text, amount) {
    if (amount <= 0.02) return this._esc(text);

    return text.split(/(\s+)/).map((word) => {
      if (!word.trim()) return word;
      if (word.length <= 3) return this._esc(word);

      let out = '';
      for (let i = 0; i < word.length; i++) {
        const ch = word[i];
        const shape = (i < 2 || i === word.length - 1) ? 0.55 : 0;
        if (/[^A-Za-z0-9]/.test(ch) || Math.random() >= amount - shape) {
          out += this._esc(ch);
        } else {
          const g = GARBLE_GLYPHS[(Math.random() * GARBLE_GLYPHS.length) | 0];
          out += `<span class="gb">${g}</span>`;
        }
      }
      return out;
    }).join('');
  }

  _esc(s) {
    return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  _paintDialogueText() {
    const node = this.dlg.node;
    const amt = this.garbleAmount;

    // what THEY say stays mostly legible — the premise is that you
    // cannot hold on to your own words, not that you have gone deaf
    this.el.dLine.innerHTML = this._garble(node.line, amt * 0.42);

    const ol = this.el.dOpts;
    ol.innerHTML = '';
    this.dlg.opts.forEach((opt, i) => {
      const li = document.createElement('li');
      const ok = this._optionAvailable(opt);
      // Anything you are able to say looks the same as anything else you
      // are able to say. Only what you CANNOT say is marked, and says why.
      li.className = ok ? 'can' : 'locked';

      const num = document.createElement('span');
      num.className = 'num'; num.textContent = i + 1;

      const txt = document.createElement('span');
      txt.className = 'txt';
      txt.innerHTML = this._garble(opt.text, amt);

      const req = document.createElement('span');
      req.className = 'req';
      // EVERY requirement, not just the first one. An option can want a stat
      // AND the room key, and showing only the stat made a locked option read
      // as satisfied -- you press it, it shakes, and nothing on screen says why.
      const parts = [];
      const spent = (opt.unlessDone && this.taskState(opt.unlessDone) === 'done')
        || (opt.once && this.usedOptions.has(opt));
      if (spent) parts.push('DONE');
      else if (opt.req) {
        // what you HAVE against what it wants, out of 100. It used to be out of
        // five pips, and rounding both sides meant 0.45 against a 0.50 gate read
        // "2/3" and 0.58 against a 0.66 gate read "3/3" -- locked, and showing as
        // met. Floor what you have, ceil what it wants, and the numbers never lie.
        // (gates are written to two places, so round is exact for them; ceil of
        // 0.07 * 100 is 8, because floating point)
        const have = Math.floor(this[opt.req.stat] * 100 + 1e-9);
        const need = Math.round(opt.req.min * 100);
        parts.push(`${opt.req.stat.toUpperCase()} ${have}/${need}`);
      }
      if (opt.needs === 'key' && !spent) parts.push(this.hasKey ? 'KEY' : 'NO KEY');
      if (opt.cost && !spent) parts.push(`$${this.money}/$${opt.cost}`);
      // a requirement you meet is not printed at all
      req.textContent = ok ? '' : parts.join('  ');

      li.append(num, txt, req);
      ol.appendChild(li);
    });

    // say plainly why the greyed-out ones are greyed out
    const blocked = this.dlg.opts.filter((o) => !this._optionAvailable(o));
    const hint = this.el.dialogue.querySelector('.dlg-hint');
    if (blocked.length) {
      // only the ones you could still fix: a spent option is not a shortfall
      const wants = [...new Set(blocked.filter((o) =>
        !(o.unlessDone && this.taskState(o.unlessDone) === 'done')
        && !(o.once && this.usedOptions.has(o))).map((o) =>
        o.req ? o.req.stat.toUpperCase() : o.cost ? 'MONEY' : 'A ROOM KEY'))].join(' or ');
      hint.innerHTML = wants
        ? `press <b>1</b>–<b>4</b> &nbsp;·&nbsp; `
          + `<span class="short">greyed out = not enough ${this._esc(wants)}</span>`
        : 'press <b>1</b>–<b>4</b>';
    } else {
      hint.innerHTML = 'press <b>1</b>–<b>4</b>';
    }
  }

  _optionAvailable(opt) {
    // the man at the bar sells you one vial, not one per conversation
    if (opt.unlessDone && this.taskState(opt.unlessDone) === 'done') return false;
    if (opt.once && this.usedOptions.has(opt)) return false;
    if (opt.needs === 'key' && !this.hasKey) return false;
    if (opt.cost && this.money < opt.cost) return false;
    if (!opt.req) return true;
    return this[opt.req.stat] >= opt.req.min;
  }

  /** @param now skip the 170ms beat before the next line (the test harness) */
  choose(index, now = false) {
    if (!this.dlg) return;
    // index is the position ON SCREEN, which is shuffled
    const opt = this.dlg.opts[index];
    if (!opt) return;

    if (!this._optionAvailable(opt)) {
      this.audio.deny();
      const li = this.el.dOpts.children[index];
      if (li) li.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-9px)' },
         { transform: 'translateX(7px)' }, { transform: 'translateX(0)' }],
        { duration: 220 });
      this.fear = clamp(this.fear + 0.035);
      return;
    }

    const li = this.el.dOpts.children[index];
    if (li) li.classList.add('chosen');
    if (opt.once) this.usedOptions.add(opt);

    this._applyEffect(opt.effect);
    if (opt.say) this.say(opt.say);
    // the payphone is the last decision in the game and it ends it
    if (opt.act) { this.closeDialogue(); this.answerPhone(opt.act === 'back'); return; }

    const next = (opt.end || !opt.go)
      ? () => this.closeDialogue()
      : () => { if (this.dlg) this._goto(opt.go); };
    if (now) next(); else setTimeout(next, 170);
  }

  _applyEffect(e) {
    if (!e) return;
    if (e.fear) this.fear = clamp(this.fear + e.fear);
    if (e.loathing) this.loathing = clamp(this.loathing + e.loathing);
    if (e.give) this.give(e.give);
    if (e.giveItem) this.giveItem(e.giveItem);
    if (e.pay) this.money = Math.max(0, this.money - e.pay);
    if (e.complete) this.completeTask(e.complete);
    if (e.hint) this.activate(e.hint);
    if (e.flag) this[e.flag] = true;
    if (e.fear > 0 || e.loathing > 0.1) this.audio.bad();
  }

  _dialogueTimeout() {
    this.audio.sting();
    // diminishing, so repeated failures cannot ladder a player into a
    // blackout they have no way of climbing out of: at high fear this
    // adds almost nothing.
    this.fear = clamp(this.fear + 0.2 * (1 - this.fear));
    this.loathing = clamp(this.loathing + 0.05 * (1 - this.loathing));
    this.say('You said nothing for a very long time.');
    this.closeDialogue();
  }

  /* ================================================ failures */

  _blackoutNow() {
    this.blackouts++;
    this._blacking = BLACKOUT_SECS;
    this.fear = 0.3;
    this.loathing = clamp(this.loathing + 0.12);
    for (const k of KEYS) { this.subs[k] *= 0.35; this.pending[k] = 0; }
    this.audio.blackout();
    this.closeDialogue();

    if (this.blackouts >= 3) {
      const [title, body] = {
        1: ['THEY FOUND YOU IN THE LOBBY',
          'Three times the floor came up to meet you. The third time, somebody in a blazer '
          + 'made a telephone call, and the telephone call was about you. The story does not get filed.'],
        2: ['DO NOT DISTURB',
          'Housekeeping finds you on the carpet between the beds at eleven the next morning, '
          + 'and the manager is very calm about it, which is the worst sign there is. '
          + 'The story does not get filed.'],
        3: ['THE HIGHWAY PATROL',
          'A patrolman finds the car idling on the shoulder with the door open and you '
          + 'lying in the gravel beside it, explaining the sunrise to nobody.'],
        4: ['THE KEYNOTE',
          'You come to on the carpet between two rows of folding chairs, and four hundred '
          + 'district attorneys are looking down at you with real professional interest. '
          + 'Somebody says the word "overdose" and somebody else writes it down.'],
      }[this.act] || [];
      this.end(false, title, body);
      return;
    }
    this.say(this.act === 1 ? '— and then the carpet. Again.' : '— and then the floor. Again.');
    this._onBlackoutEnd = () => {
      this.toast('YOU CAME BACK', 'warn');
      this._onBlackoutEnd = null;
    };
  }

  _batCountry() {
    this.audio.bats();
    const where = ['over the floor', 'across the ceiling of the suite',
                   'out of the sunrise', 'down out of the ballroom lights'][this.act - 1]
                   || 'over the floor';
    this.end(false, 'BAT COUNTRY',
      `They came in low ${where}, about a dozen of them, and there was no point `
      + 'explaining to anyone that they were not there. The loathing had finally arrived, '
      + 'fully grown, and it had wings.');
  }

  end(won, title, body) {
    if (this.over) return;
    this.over = true;
    this.won = won;
    this.closeDialogue();
    const done = this.tasks.filter((t) => t.state === 'done').length;

    const ec = this.el.endcard;
    ec.classList.toggle('win', won);
    ec.querySelector('h1').textContent = title;
    ec.querySelector('.end-body').textContent = body;
    ec.querySelector('.end-stats').innerHTML =
      `ERRANDS COMPLETED &nbsp;${done} / ${TASK_DEFS.length}<br>`
      + `DOSES TAKEN &nbsp;${this.dosesTaken}<br>`
      + `BLACKOUTS &nbsp;${this.blackouts}<br>`
      + (this.crashes ? `WRECKS &nbsp;${this.crashes}<br>` : '')
      + `FINAL LOATHING &nbsp;${Math.round(this.loathing * 100)}%<br>`
      + `TIME ON THE FLOOR &nbsp;${Math.floor(this.elapsed / 60)}m ${Math.floor(this.elapsed % 60)}s`;
    setTimeout(() => ec.classList.remove('hidden'), won ? 1200 : 2200);
    document.exitPointerLock?.();
  }

  /* The lift used to be the end of it. Now it is the door into the
     second act: the public game is over and the private one starts. */
  enterSuite() {
    // Standing in 1850 means you got past the desk, the bar, the floor and
    // the man at the lift, whatever the flags happen to say. Anything still
    // open down there is unreachable from up here, so reconcile it rather
    // than leave an errand the player can never close.
    ['checkin', 'score', 'briefcase', 'security'].forEach((id) => this.completeTask(id));
    this.completeTask('room');
    this.act = 2;
    this.activate('bath');
    this._renderTasks();
    this.say('The doors close on the whole howling floor of it, and for eleven '
      + 'seconds there is only the hum of the cable.');
  }

  /* Back down in the lift. The same floor, the same four hundred district
     attorneys, and the only errand left is the front door. */
  leaveSuite() {
    ['bath', 'maid', 'story'].forEach((id) => this.completeTask(id));
    this.completeTask('downstairs');
    this.act = 1;
    this.leaving = true;
    this.activate('checkout');
    this._renderTasks();
    this.say('The doors open on the whole howling floor of it again. The front '
      + 'doors are all the way across it, by the desk.');
  }

  /* The real ending. You do not win this by surviving the night -- the night
     was the easy part -- you win it by being able to write the thing down
     afterwards, which is the one job the chemistry cannot do for you. */
  fileStory() {
    if (this.composure < STORY_COMPOSURE) {
      this.audio.deny();
      this.say('The keys are there. The words are not. You cannot hold a '
        + 'sentence still long enough to hit it. Wait for it to wear off, '
        + 'or find something that steadies the hands.');
      this.fear = clamp(this.fear + 0.06);
      return false;
    }
    // The act does NOT change here. Setting act 3 on this line handed the
    // player to the driving code while they were still standing in the
    // suite, 600m from the road -- which it read as a crash, and ended the
    // game on the red card the moment the story was filed. You walk out:
    // the hall, the lift, the floor, the front doors, and then the car.
    this.completeTask('story');
    this.activate('downstairs');
    this.say('Two thousand words, most of them true, none of them the assignment. '
      + 'Now get out of this town before somebody reads it.');
    return true;
  }

  /* The drive is over when you find somewhere to stop, and the phone is
     ringing before the engine has finished ticking. */
  arrive() {
    if (this.taskState('drive') === 'done') return;
    this.completeTask('drive');
    this.activate('callback');
    this.say('A motel, a payphone, and nothing else for forty miles. '
      + 'The phone starts ringing before you have the door shut.');
  }

  /* You ran off the road hard enough to stop the car. It used to be the end
     card, and the drive is the easiest place in the game to earn one, so a
     night's work went with a single lamp post. It is a cut to black now:
     main.js hears it through onWreck, runs the fade, and calls wakeAtBar
     in the dark. */
  crash(kind) {
    if (this.over || this._crashing) return;
    this._crashing = true;
    this.crashes++;
    const line = {
      parked: 'A parked station wagon, at forty miles an hour.',
      pole: 'The one thing on the whole street that was not moving: a lamp post.',
      storefront: 'The one place in Nevada with something to hit, and it is a pawnshop.',
      traffic: 'It came over the rise in its own lane, which by then was also your lane.',
    }[kind] || 'The shoulder goes soft, then it goes away, and so does the car.';
    this.closeDialogue();
    this.audio.bad();
    this.audio.blackout();
    this.toast('WRECKED', 'bad');
    this.say(line);
    if (this.onWreck) this.onWreck(kind);
    else this.end(false, 'OFF THE ROAD', line);
  }

  /* Somebody got you and the car back to the hotel, and you come to on a
     stool at the bar. What it cost: the case -- every last thing in it --
     and the car, which still runs but looks it. What is already in your
     blood stays there. Where you pick up depends on which drive it was:
       out    the outbound drive, from the front doors again
       final  the last drive west, the same
       return the drive back, which you have finished, after a fashion:
              the convention is through the lounge, off the lobby */
  wakeAtBar(leg) {
    this._crashing = false;
    for (const k of KEYS) { this.stock[k] = 0; this.pending[k] = 0; }
    this.fear = 0.3;
    this.act = 1;
    this.leaving = true;
    if (leg === 'out') {
      // back to the front doors; the drive (and anything after it) is undone
      ['drive', 'callback'].forEach((id) => {
        const t = this.tasks.find((x) => x.id === id);
        if (t) t.state = 'todo';
      });
      const t = this.tasks.find((x) => x.id === 'checkout');
      if (t) t.state = 'active';
    }
    this._renderInv();
    this._renderTasks();
    this.toast('THE CASE IS EMPTY', 'bad');
    this.say('You come to on a stool at the bar with a drink you did not order. '
      + 'Somebody brought the car back round, and it looks like it lost an argument. '
      + 'The case is gone, every last thing in it. '
      + (leg === 'return'
        ? 'It is nine in the morning, and the convention is through the lounge, off the east side of the lobby.'
        : 'The car is out front. It still runs.'), null, 8);
  }

  /* The end of it. In the film the call sends him straight back into the
     thing he just escaped, which is the joke: there is no getting out,
     there is only the next assignment. */
  answerPhone(goingBack) {
    this.completeTask('callback');
    if (goingBack) {
      this.pendingReturn = true;
      this.activate('return');
      this.say('You put the phone down, get back in the car, and point it back '
        + 'the way you came. Of course you do.');
    } else {
      this.end(true, 'KEEP DRIVING',
        'You put the phone back on the hook and stand in the lot until the sun is '
        + 'all the way up. Somewhere behind you four hundred district attorneys are '
        + 'being told what a marijuana looks like, and for the first time in two days '
        + 'that is somebody else\'s problem. The tank is half full. It will do.');
    }
  }

  /* Back up the road and under the porte-cochère: the hotel again, and it
     is nine in the morning and the seminar is waiting. This used to be the
     end card. It is the door into the fourth act now. */
  finishReturn() {
    if (this.over) return;
    this.completeTask('return');
    this.say('You stop at the light with the engine running and a valet you have never '
      + 'seen before gets in and takes it round the court. The hotel is exactly where '
      + 'you left it, which is the one surprise left in the night.', null, 6);
  }

  /* ACT FOUR. Through the lobby and into the ballroom off the east wing. */
  enterConvention() {
    // everything before the convention is behind you, however you got here
    this.tasks.filter((t) => ['floor', 'room', 'out', 'road'].includes(t.stage))
      .forEach((t) => this.completeTask(t.id));
    this.act = 4;
    this.leaving = false;
    this.activate('badge');
    this._renderTasks();
    this.say('The convention wing. A banner, a table of name badges, and behind the '
      + 'double doors four hundred district attorneys waiting to be told what a drug is.',
      null, 6);
  }

  /* The keynote. Started by sitting down; main.js calls updateLecture every
     frame you stay in the chair, and it hands back the slide to show. */
  startLecture() {
    if (this.lecture) return;
    this.lecture = { i: -1, t: 1e9, asked: false };
  }

  updateLecture(dt) {
    const L = this.lecture;
    if (!L || this.dlg || this.over) return null;
    // time drags on the slow-clock drugs: acid makes the keynote last forever
    L.t += dt / (1 + this.slowClock * 0.6);
    const cur = LECTURE[L.i];
    if (cur && cur.ask && !L.asked && L.t > 3.2) {
      L.asked = true;
      this.openDialogue(cur.ask);
      return null;
    }
    if (cur && L.t < cur.t) return null;
    L.i++;
    L.t = 0;
    L.asked = false;
    const next = LECTURE[L.i];
    if (!next) {
      this.lecture = null;
      this.completeTask('seminar');
      this.say('Applause, of a sort. Chairs scrape. Your attorney is standing at the '
        + 'back by the urn, beckoning with his whole arm.', null, 5);
      return { done: true };
    }
    this.say(next.line, next.who || 'THE KEYNOTE', next.t * (1 + this.slowClock * 0.6));
    // the drug on the screen is the drug in your blood: he is not looking at you
    const S = SUBSTANCES[next.slide];
    if (S && next.who !== YOU && this.subs[next.slide] > 0.08) {
      this.fear = clamp(this.fear + 0.14);
      this.audio.sting();
      this.toast('HE IS LOOKING RIGHT AT YOU', 'bad');
    }
    return { slide: next.slide, S };
  }

  /** you got up in the middle of it and walked out down the aisle */
  leaveLecture() {
    if (!this.lecture) return;
    this.lecture = null;
    this.loathing = clamp(this.loathing + 0.08);
    this.fear = clamp(this.fear + 0.1);
    this.completeTask('seminar');
    this.say('You get up in the middle of a slide and walk out up the aisle, and the '
      + 'keynote speaker stops talking until you are gone.', null, 5);
  }

  /* ACT FIVE. Back out through the lobby, where the bill is waiting. */
  enterFinale() {
    this.tasks.filter((t) => t.stage !== 'last').forEach((t) => this.completeTask(t.id));
    this.act = 1;
    this.leaving = true;
    this.finale = true;
    this.activate('bill');
    this._renderTasks();
    this.say('Back through the lobby. The desk is where it always was, and so is Swan, '
      + 'and she is holding a piece of paper with your room number on it.', null, 6);
  }

  /* The last ending, and the one the whole night has been driving toward:
     not caught, not dead, not redeemed. Just gone, and looking back. */
  finishWestward() {
    if (this.over) return;
    this.completeTask('westward');
    let body = 'The telephone at the motor lodge is ringing as you go past it, and you '
      + 'let it ring. From the top of the grade you can see the whole town laid out '
      + 'behind you on the flat, still lit up in broad daylight, as if the tide went out '
      + 'and forgot it. A few years ago it would have looked like a wave. From up here '
      + 'it looks like the line on the rocks where one used to break.';
    body += this.billPaid ? ' The bill is paid, which nobody is going to believe.'
      : this.billMag ? ' The magazine gets the bill. Then the magazine gets a lawyer.'
      : this.billAtty ? ' The bill belongs to your attorney now, which is to say to nobody.'
      : this.billRun ? ' Somewhere back there a desk clerk is still saying sir.' : '';
    if (this.georgiaSpooked) {
      body += ' And in Georgia a district attorney is going to sleep with the lights on '
        + 'for a year.';
    }
    body += ' West is the only direction left with an ocean at the end of it.';
    this.end(true, 'THE HIGH-WATER MARK', body);
  }

  /* ============================================== presentation */

  say(text, who, secs = 4.2) {
    const el = this.el.subtitle;
    el.innerHTML = (who ? `<span class="who">${who}</span>` : '') + this._esc(text);
    el.classList.remove('hidden');
    this._sayTimer = secs;
  }

  toast(text, kind = 'info') {
    const d = document.createElement('div');
    d.className = 'toast ' + kind;
    d.textContent = text;
    this.el.toasts.appendChild(d);
    // never a wall of them: the oldest goes when a fourth arrives
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 2500);
  }

  setPrompt(label, locked) {
    const p = this.el.prompt;
    if (!label || this.dlg) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    p.innerHTML = `<b>E</b>${this._esc(label)}`
      + (locked ? `<span class="locked">${this._esc(locked)}</span>` : '');
  }

  /* -------------------------------------------------- HUD */
  _buildInventory() {
    this.el.inv.innerHTML = '';
    for (const k of KEYS) {
      const S = SUBSTANCES[k];
      const d = document.createElement('div');
      d.className = 'vial'; d.dataset.k = k;
      // each card carries its own accent, so adding a substance to the
      // table never means editing the stylesheet
      d.style.setProperty('--c', S.color);
      d.innerHTML =
        `<span class="key">${S.key}</span>`
        + `<div class="glyph" style="color:${S.color}">${S.glyph}</div>`
        + `<div class="nm">${S.name}</div>`
        + `<div class="eff">${billing(S)}</div>`
        + `<div class="lvl"><i></i></div>`
        + `<div class="ct">×0</div>`;
      this.el.inv.appendChild(d);
    }
  }

  _renderInv() {
    for (const k of KEYS) {
      const d = this.el.inv.querySelector(`.vial[data-k="${k}"]`);
      d.querySelector('.ct').textContent = '×' + (this.stock[k] || 0);
      d.classList.toggle('empty', !this.stock[k]);
    }
  }

  _renderTasks() {
    const ul = this.el.tasks;
    ul.innerHTML = '';
    // Only this act's errands. By the drive the list was eleven lines long,
    // ten of them struck through, and it covered a third of the windscreen.
    const title = this.el.tasksPanel?.querySelector('.tasks-title');
    if (title) title.textContent = { floor: 'THE ITINERARY', room: 'ROOM 1850',
      out: 'CHECKING OUT', road: 'THE ROAD OUT', convention: 'THE CONVENTION',
      last: 'THE LAST MORNING' }[this.stage];
    this.tasks.forEach((t) => {
      if (t.state === 'todo') return;
      if (t.stage !== this.stage && t.state === 'done') return;
      const li = document.createElement('li');
      li.className = t.state;
      li.textContent = t.text;
      ul.appendChild(li);
    });
  }

  _paintHUD() {
    const root = document.documentElement.style;
    const c = (this._css ??= { wreck: '', fear: '', loathing: '' });
    const wreck = this.wreck.toFixed(3);
    const fear = this.fear.toFixed(3);
    const loathing = this.loathing.toFixed(3);
    if (wreck !== c.wreck)     { c.wreck     = wreck;     root.setProperty('--wreck', wreck); }
    if (fear !== c.fear)       { c.fear      = fear;      root.setProperty('--fear', fear); }
    if (loathing !== c.loathing) { c.loathing = loathing; root.setProperty('--loathing', loathing); }

    const w = document.getElementById('wallet');
    if (w) {
      w.querySelector('.amt').textContent = '$' + this.money;
      w.classList.toggle('broke', this.money < 15);
    }

    this.el.meters.forEach((m) => {
      const k = m.dataset.k;
      const v = k === 'fear' ? this.fear : this.loathing;
      m.querySelector('i').style.width = (v * 100).toFixed(1) + '%';
      m.classList.toggle('critical', v > 0.8);
    });

    this.el.stats.forEach((s) => {
      const v = this[s.dataset.k];
      const pips = s.querySelector('.pips');
      if (pips.children.length !== 5) {
        pips.innerHTML = '<b></b><b></b><b></b><b></b><b></b>';
      }
      const on = Math.round(v * 5);
      [...pips.children].forEach((b, i) => b.classList.toggle('on', i < on));
    });

    for (const k of KEYS) {
      const d = this.el.inv.querySelector(`.vial[data-k="${k}"]`);
      d.querySelector('.lvl i').style.width = (this.subs[k] * 100).toFixed(1) + '%';
      d.classList.toggle('active', this.subs[k] > 0.02);
    }
  }
}

export { DIALOGUE };
