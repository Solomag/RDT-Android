// RDT-ANDROID-MODULE v1

(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/core/deckcode.ts
  function deckCode(countsByBase, codeOf) {
    const byCount = Array.from({ length: 9 }, () => []);
    let max = 3;
    for (const [hash, count] of countsByBase) {
      const code = codeOf(hash);
      if (!code || count <= 0 || count >= 9) return "";
      max = Math.max(max, count);
      byCount[count].push(code);
    }
    let out = "SP";
    for (let count = 1; count <= max; count++) {
      const n = byCount[count].length;
      out += String.fromCharCode(65 + Math.floor(n / 26), 65 + n % 26) + byCount[count].join("");
    }
    return out;
  }

  // src/core/rdtrec.ts
  var ChunkHeader = 0;
  var ChunkQueue = 1;
  function encodeChunk(type, data) {
    const out = new Uint8Array(5 + data.length);
    out[0] = type;
    new DataView(out.buffer).setInt32(1, data.length, true);
    out.set(data, 5);
    return out;
  }
  function encodeHeader(h) {
    const keys = ["local", "deck", "code", "name"];
    for (const k of Object.keys(h)) if (!keys.includes(k)) keys.push(k);
    const text = keys.map((k) => `${k}=${h[k] ?? ""}`).join("\n") + "\n";
    return utf8Encode(text);
  }
  function utf8Encode(s) {
    const bytes = [];
    for (const ch of s) {
      let c = ch.codePointAt(0);
      if (c < 128) bytes.push(c);
      else if (c < 2048) bytes.push(192 | c >> 6, 128 | c & 63);
      else if (c < 65536) bytes.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
      else bytes.push(240 | c >> 18, 128 | c >> 12 & 63, 128 | c >> 6 & 63, 128 | c & 63);
    }
    return Uint8Array.from(bytes);
  }
  function utf8Decode(b) {
    let s = "";
    for (let i = 0; i < b.length; ) {
      const x = b[i++];
      let c;
      if (x < 128) c = x;
      else if (x < 224) c = (x & 31) << 6 | b[i++] & 63;
      else if (x < 240) c = (x & 15) << 12 | (b[i++] & 63) << 6 | b[i++] & 63;
      else c = (x & 7) << 18 | (b[i++] & 63) << 12 | (b[i++] & 63) << 6 | b[i++] & 63;
      s += String.fromCodePoint(c);
    }
    return s;
  }

  // src/core/proto/schema.json
  var schema_default = {
    "CcgRpc.CardCommandItem": {
      "1": {
        name: "CommandList",
        type: "message",
        message: "CcgRpc.CardCommandList"
      },
      "2": {
        name: "OpponentCommandList",
        type: "message",
        message: "CcgRpc.OpponentCardCommandList"
      }
    },
    "CcgRpc.CardCommandList": {
      "1": {
        name: "ListUid",
        type: "int32"
      },
      "4": {
        name: "MustSelectCommand",
        type: "bool"
      },
      "5": {
        name: "IsMulliganPhase",
        type: "bool"
      },
      "6": {
        name: "ValidCommands",
        type: "message",
        repeated: true,
        message: "CcgRpc.CardCommandState"
      },
      "7": {
        name: "AlreadyUsedCardUids",
        type: "int32",
        repeated: true
      },
      "8": {
        name: "NotReadyCardUids",
        type: "int32",
        repeated: true
      },
      "9": {
        name: "FullLaneCardUids",
        type: "int32",
        repeated: true
      }
    },
    "CcgRpc.CardCommandState": {
      "1": {
        name: "CardNetUid",
        type: "int32"
      },
      "2": {
        name: "SourceOverrideNetUid",
        type: "int32"
      },
      "3": {
        name: "ValidCardCommandMask",
        type: "int32"
      },
      "4": {
        name: "ValidBoardLanes",
        type: "int32"
      },
      "5": {
        name: "FullBoardLanes",
        type: "int32"
      },
      "6": {
        name: "PlayTargets",
        type: "int32",
        repeated: true
      },
      "7": {
        name: "AttackTargets",
        type: "int32",
        repeated: true
      },
      "8": {
        name: "ActiveAbilityTargets",
        type: "int32",
        repeated: true
      },
      "9": {
        name: "EquipTargets",
        type: "int32",
        repeated: true
      },
      "10": {
        name: "LaneTargets",
        type: "enum",
        repeated: true
      },
      "11": {
        name: "CustomCardUiEnum",
        type: "int32"
      },
      "12": {
        name: "DisplayCards",
        type: "message",
        repeated: true,
        message: "CcgRpc.HistoryCard"
      },
      "13": {
        name: "NumActionChoices",
        type: "int32"
      },
      "14": {
        name: "TargetingPromptLocKey",
        type: "string"
      },
      "15": {
        name: "CustomPromptLocKey",
        type: "string"
      }
    },
    "CcgRpc.CardLink": {
      "1": {
        name: "LinkedToCardUid",
        type: "int32"
      },
      "2": {
        name: "HiddenFromOwner",
        type: "bool"
      },
      "3": {
        name: "HiddenFromOppponent",
        type: "bool"
      },
      "4": {
        name: "LinkOwnerNetId",
        type: "int32"
      }
    },
    "CcgRpc.CardPosition": {
      "1": {
        name: "OwningPlayerUid",
        type: "int32"
      },
      "2": {
        name: "GameZoneName",
        type: "int32"
      },
      "3": {
        name: "GameZoneType",
        type: "int32"
      },
      "4": {
        name: "LaneIndex",
        type: "int32"
      },
      "5": {
        name: "PositionIndex",
        type: "int32"
      }
    },
    "CcgRpc.Doinker": {
      "1": {
        name: "DoinkerIdShow",
        type: "int32"
      },
      "2": {
        name: "DoinkerIdHide",
        type: "int32"
      }
    },
    "CcgRpc.DynamicTagReference": {
      "1": {
        name: "CardIdReference",
        type: "int32"
      },
      "2": {
        name: "TagId",
        type: "int32"
      }
    },
    "CcgRpc.Enchantment": {
      "1": {
        name: "SourceCardId",
        type: "int32"
      },
      "2": {
        name: "TitleLocKey",
        type: "string"
      },
      "3": {
        name: "TextLocKey",
        type: "string"
      },
      "4": {
        name: "EnchantmentMechanics",
        type: "message",
        repeated: true,
        message: "CcgRpc.UIMechanicsInformation"
      },
      "5": {
        name: "EnchantmentCardReferences",
        type: "int32",
        repeated: true
      },
      "6": {
        name: "Type",
        type: "enum"
      },
      "7": {
        name: "AdditionalCreatureSubtypes",
        type: "int32",
        repeated: true
      },
      "8": {
        name: "NewColorSubtypes",
        type: "int32",
        repeated: true
      },
      "9": {
        name: "TagReferences",
        type: "message",
        repeated: true,
        message: "CcgRpc.DynamicTagReference"
      }
    },
    "CcgRpc.FloatingCards": {
      "1": {
        name: "CardNetUids",
        type: "int32",
        repeated: true
      }
    },
    "CcgRpc.FullGameState": {
      "1": {
        name: "PlayerStates",
        type: "message",
        repeated: true,
        message: "CcgRpc.FullPlayerState"
      },
      "2": {
        name: "NeverExclude",
        type: "bool"
      },
      "3": {
        name: "HistoryQueue",
        type: "message",
        message: "CcgRpc.HistoryQueue"
      },
      "4": {
        name: "CurrentTurnPlayerId",
        type: "int32"
      },
      "5": {
        name: "DuringMulligan",
        type: "bool"
      }
    },
    "CcgRpc.FullPlayerState": {
      "1": {
        name: "Player",
        type: "message",
        message: "CcgRpc.HistoryPlayer"
      },
      "2": {
        name: "StaticGameZones",
        type: "message",
        repeated: true,
        message: "CcgRpc.NetStaticGameZone"
      },
      "3": {
        name: "DynamicGameZones",
        type: "message",
        repeated: true,
        message: "CcgRpc.NetDynamicGameZone"
      }
    },
    "CcgRpc.Hanger": {
      "1": {
        name: "TitleLocKey",
        type: "string"
      },
      "2": {
        name: "TextLocKey",
        type: "string"
      },
      "3": {
        name: "ImageSourceReference",
        type: "int32"
      }
    },
    "CcgRpc.HistoryCard": {
      "1": {
        name: "CardNetUid",
        type: "int32"
      },
      "2": {
        name: "CurrentPosition",
        type: "message",
        message: "CcgRpc.CardPosition"
      },
      "3": {
        name: "IsFullState",
        type: "bool"
      },
      "4": {
        name: "Silenced",
        type: "bool"
      },
      "5": {
        name: "CardId",
        type: "int32"
      },
      "6": {
        name: "CurrentHealth",
        type: "int32"
      },
      "7": {
        name: "AffectedAttributeName",
        type: "int32",
        repeated: true
      },
      "8": {
        name: "AffectedAttributeValue",
        type: "int32",
        repeated: true
      },
      "9": {
        name: "AffectedRareAttributeName",
        type: "int32",
        repeated: true
      },
      "10": {
        name: "AffectedRareAttributeValue",
        type: "int32",
        repeated: true
      },
      "11": {
        name: "BaseOverrideAttributeName",
        type: "int32",
        repeated: true
      },
      "12": {
        name: "BaseOverrideAttributeValue",
        type: "int32",
        repeated: true
      },
      "13": {
        name: "Enchantments",
        type: "message",
        repeated: true,
        message: "CcgRpc.Enchantment"
      },
      "14": {
        name: "HuntStates",
        type: "message",
        repeated: true,
        message: "CcgRpc.TreasureHuntState"
      },
      "15": {
        name: "Hangers",
        type: "message",
        repeated: true,
        message: "CcgRpc.Hanger"
      },
      "16": {
        name: "Links",
        type: "message",
        repeated: true,
        message: "CcgRpc.CardLink"
      },
      "17": {
        name: "OverrideCardId",
        type: "int32"
      },
      "18": {
        name: "IsPremium",
        type: "bool"
      },
      "19": {
        name: "UseCurrentHealth",
        type: "bool"
      },
      "20": {
        name: "TotalAbilityUses",
        type: "int32"
      },
      "21": {
        name: "CreatorCardId",
        type: "int32"
      },
      "22": {
        name: "PreviousGameZoneType",
        type: "int32"
      },
      "23": {
        name: "ItemOwnerNetUid",
        type: "int32"
      },
      "24": {
        name: "GrantsAuras",
        type: "bool"
      },
      "25": {
        name: "HasHealthDebuff",
        type: "bool"
      },
      "26": {
        name: "HasPowerDebuff",
        type: "bool"
      },
      "27": {
        name: "HasCostDebuff",
        type: "bool"
      },
      "28": {
        name: "ComponentCards",
        type: "message",
        repeated: true,
        message: "CcgRpc.HistoryCard"
      },
      "29": {
        name: "IsRevealed",
        type: "bool"
      },
      "30": {
        name: "HideAuraStatusFx",
        type: "bool"
      }
    },
    "CcgRpc.HistoryInputVisualization": {
      "1": {
        name: "PlayerInstanceId",
        type: "int32"
      },
      "2": {
        name: "Card",
        type: "message",
        message: "CcgRpc.HistoryCard"
      },
      "3": {
        name: "TargetCard",
        type: "message",
        message: "CcgRpc.HistoryCard"
      },
      "4": {
        name: "EmoteType",
        type: "int32"
      },
      "7": {
        name: "DragLaneIndex",
        type: "int32"
      }
    },
    "CcgRpc.HistoryItem": {
      "1": {
        name: "Type",
        type: "enum"
      },
      "2": {
        name: "ActingPlayerInstanceId",
        type: "int32"
      },
      "3": {
        name: "ActorCardNetUid",
        type: "int32"
      },
      "4": {
        name: "TargetCardNetUid",
        type: "int32"
      },
      "5": {
        name: "AssetHash",
        type: "int32"
      },
      "6": {
        name: "EffectTriggerType",
        type: "int32"
      },
      "7": {
        name: "PlayerAttributeName",
        type: "int32"
      },
      "8": {
        name: "PlayerAttributeValue",
        type: "int32"
      },
      "9": {
        name: "GameZoneName",
        type: "int32"
      },
      "10": {
        name: "DrainTargetCardNetUid",
        type: "int32"
      },
      "11": {
        name: "AffectedPlayersArray",
        type: "message",
        repeated: true,
        message: "CcgRpc.HistoryPlayer"
      },
      "12": {
        name: "AffectedCardsArray",
        type: "message",
        repeated: true,
        message: "CcgRpc.HistoryCard"
      },
      "13": {
        name: "AffectedLanesArray",
        type: "message",
        repeated: true,
        message: "CcgRpc.HistoryLane"
      },
      "14": {
        name: "TestSubtype",
        type: "int32"
      },
      "15": {
        name: "CardCommandItem",
        type: "message",
        message: "CcgRpc.CardCommandItem"
      },
      "16": {
        name: "FullGameState",
        type: "message",
        message: "CcgRpc.FullGameState"
      },
      "17": {
        name: "InputVisualization",
        type: "message",
        message: "CcgRpc.HistoryInputVisualization"
      },
      "18": {
        name: "MatchIntroPlayers",
        type: "message",
        repeated: true,
        message: "CcgRpc.HistoryPlayerDescription"
      },
      "19": {
        name: "MatchIntroLanes",
        type: "message",
        repeated: true,
        message: "CcgRpc.MessageDynamicCardLane"
      },
      "20": {
        name: "MulliganDisabled",
        type: "bool"
      },
      "21": {
        name: "IsBonusMatch",
        type: "bool"
      },
      "22": {
        name: "IsLegendsMatch",
        type: "bool"
      },
      "23": {
        name: "DoinkerInformation",
        type: "message",
        message: "CcgRpc.Doinker"
      },
      "24": {
        name: "DialogueId",
        type: "int32"
      },
      "25": {
        name: "FloatingCardsUpdate",
        type: "message",
        message: "CcgRpc.FloatingCards"
      },
      "26": {
        name: "IgnoredByClientLog",
        type: "bool"
      },
      "27": {
        name: "SanitizeRule",
        type: "enum"
      },
      "28": {
        name: "MechanicType",
        type: "int32"
      },
      "29": {
        name: "EquipCardNetUid",
        type: "int32"
      },
      "30": {
        name: "UseProphecyBanner",
        type: "bool"
      },
      "31": {
        name: "UseActingLane",
        type: "bool"
      },
      "32": {
        name: "ActingLaneType",
        type: "int32"
      },
      "33": {
        name: "ActingLaneIndex",
        type: "int32"
      },
      "34": {
        name: "TimeRemainingMillisecondsUpdate",
        type: "int32"
      },
      "35": {
        name: "InitialAllowedMillisecondsUpdate",
        type: "int32"
      }
    },
    "CcgRpc.HistoryLane": {
      "1": {
        name: "PlayerInstanceId",
        type: "int32"
      },
      "2": {
        name: "ZoneName",
        type: "int32"
      },
      "3": {
        name: "ZoneType",
        type: "int32"
      },
      "4": {
        name: "LaneIndex",
        type: "int32"
      },
      "5": {
        name: "LaneType",
        type: "int32"
      },
      "6": {
        name: "ExtraLaneType",
        type: "int32"
      }
    },
    "CcgRpc.HistoryPlayer": {
      "1": {
        name: "IsFullState",
        type: "bool"
      },
      "2": {
        name: "PlayerUid",
        type: "int32"
      },
      "3": {
        name: "DeckCardCount",
        type: "int32"
      },
      "4": {
        name: "AttributeNames",
        type: "int32",
        repeated: true
      },
      "5": {
        name: "AttributeValues",
        type: "int32",
        repeated: true
      },
      "6": {
        name: "RareAttributeNames",
        type: "int32",
        repeated: true
      },
      "7": {
        name: "RareAttributeValues",
        type: "int32",
        repeated: true
      },
      "8": {
        name: "ActionLevelCardIds",
        type: "int32",
        repeated: true
      },
      "9": {
        name: "ActionLevelValues",
        type: "int32",
        repeated: true
      },
      "11": {
        name: "Spectators",
        type: "string",
        repeated: true
      },
      "12": {
        name: "ValidDeckCount",
        type: "bool"
      },
      "13": {
        name: "DualSpectators",
        type: "string",
        repeated: true
      }
    },
    "CcgRpc.HistoryPlayerDescription": {
      "1": {
        name: "PlayerInstanceId",
        type: "int32"
      },
      "2": {
        name: "PlayerName",
        type: "string"
      },
      "3": {
        name: "AiOpponentId",
        type: "int32"
      },
      "4": {
        name: "DeckColorNames",
        type: "int32",
        repeated: true
      },
      "5": {
        name: "InventoryTypes",
        type: "string",
        repeated: true
      },
      "6": {
        name: "InventoryValues",
        type: "string",
        repeated: true
      },
      "7": {
        name: "Health",
        type: "int32"
      },
      "8": {
        name: "IsHuman",
        type: "bool"
      },
      "9": {
        name: "NumStartingRunes",
        type: "int32"
      },
      "10": {
        name: "Rank",
        type: "int32"
      },
      "11": {
        name: "LegendRank",
        type: "int32"
      },
      "12": {
        name: "VoOverride",
        type: "string"
      },
      "13": {
        name: "ArenaBonusMatch",
        type: "bool"
      }
    },
    "CcgRpc.HistoryQueue": {
      "1": {
        name: "Queue",
        type: "message",
        repeated: true,
        message: "CcgRpc.HistoryItem"
      }
    },
    "CcgRpc.MessageDynamicCardLane": {
      "1": {
        name: "Cards",
        type: "message",
        repeated: true,
        message: "CcgRpc.HistoryCard"
      },
      "2": {
        name: "LaneType",
        type: "int32"
      },
      "3": {
        name: "LaneSize",
        type: "int32"
      },
      "4": {
        name: "ExtraLaneType",
        type: "int32"
      },
      "5": {
        name: "ZoneName",
        type: "int32"
      },
      "6": {
        name: "LaneIndex",
        type: "int32"
      }
    },
    "CcgRpc.MessageStaticCardLane": {
      "1": {
        name: "Cards",
        type: "message",
        repeated: true,
        message: "CcgRpc.HistoryCard"
      },
      "2": {
        name: "LaneType",
        type: "int32"
      },
      "3": {
        name: "LaneSize",
        type: "int32"
      }
    },
    "CcgRpc.NetDynamicGameZone": {
      "1": {
        name: "ZoneName",
        type: "int32"
      },
      "2": {
        name: "ZoneType",
        type: "int32"
      },
      "3": {
        name: "TotalCardCount",
        type: "int32"
      },
      "4": {
        name: "Lanes",
        type: "message",
        repeated: true,
        message: "CcgRpc.MessageDynamicCardLane"
      }
    },
    "CcgRpc.NetStaticGameZone": {
      "1": {
        name: "ZoneName",
        type: "int32"
      },
      "2": {
        name: "ZoneType",
        type: "int32"
      },
      "3": {
        name: "TotalCardCount",
        type: "int32"
      },
      "4": {
        name: "Lanes",
        type: "message",
        repeated: true,
        message: "CcgRpc.MessageStaticCardLane"
      }
    },
    "CcgRpc.OpponentCardCommandList": {
      "1": {
        name: "ActionablePublicCardNetUids",
        type: "int32",
        repeated: true
      },
      "4": {
        name: "ValidCommands",
        type: "message",
        repeated: true,
        message: "CcgRpc.CardCommandState"
      },
      "5": {
        name: "ListUid",
        type: "int32"
      }
    },
    "CcgRpc.TreasureHuntState": {
      "1": {
        name: "HuntType",
        type: "int32"
      },
      "2": {
        name: "HuntProgress",
        type: "int32",
        repeated: true
      },
      "3": {
        name: "Complete",
        type: "bool"
      }
    },
    "CcgRpc.UIMechanicsInformation": {
      "1": {
        name: "UiMechanicType",
        type: "int32"
      },
      "2": {
        name: "DisplayHanger",
        type: "bool"
      },
      "3": {
        name: "DisplayIcon",
        type: "bool"
      }
    }
  };

  // src/core/proto/decode.ts
  var schema = schema_default;
  function decodeMessage(bytes, message, stats = { unknownFields: 0 }) {
    return new Reader(bytes, stats).message(message, bytes.length);
  }
  function decodeHistoryQueue(bytes, stats) {
    return decodeMessage(bytes, "CcgRpc.HistoryQueue", stats);
  }
  var prototypes = /* @__PURE__ */ new Map();
  var NONE = Object.freeze([]);
  var EMPTY = new Uint8Array(0);
  function defaults(message) {
    let proto = prototypes.get(message);
    if (!proto) {
      const fields = schema[message];
      if (!fields) throw Error(`unknown message ${message}`);
      proto = {};
      for (const f of Object.values(fields))
        proto[f.name] = f.repeated ? NONE : f.type === "message" ? null : f.type === "bool" ? false : f.type === "string" ? "" : f.type === "bytes" ? EMPTY : 0;
      prototypes.set(message, proto);
    }
    return Object.create(proto);
  }
  var numberTables = /* @__PURE__ */ new Map();
  function byNumber(message) {
    let table = numberTables.get(message);
    if (!table) {
      const fields = schema[message];
      if (!fields) throw Error(`unknown message ${message}`);
      table = [];
      for (const [n, f] of Object.entries(fields)) table[Number(n)] = f;
      numberTables.set(message, table);
    }
    return table;
  }
  function own(o, name) {
    let list = o[name];
    if (list === NONE) o[name] = list = [];
    return list;
  }
  var Reader = class {
    constructor(buf, stats) {
      __publicField(this, "buf", buf);
      __publicField(this, "stats", stats);
      __publicField(this, "pos", 0);
    }
    message(name, end) {
      const fields = byNumber(name), o = defaults(name);
      while (this.pos < end) {
        const tag = this.varint();
        const number = Math.floor(tag / 8), wire = tag & 7;
        const f = fields[number];
        if (!f) {
          this.stats.unknownFields++;
          this.skip(wire);
          continue;
        }
        if (f.repeated && wire === 2 && f.type !== "message" && f.type !== "string" && f.type !== "bytes") {
          const stop = this.length();
          const list = own(o, f.name);
          while (this.pos < stop) list.push(this.scalar(f.type, f.type === "float" ? 5 : f.type === "double" ? 1 : 0));
          continue;
        }
        const v = this.value(f, wire);
        if (f.repeated) own(o, f.name).push(v);
        else o[f.name] = v;
      }
      if (this.pos !== end) throw Error(`${name}: read past its end`);
      return o;
    }
    value(f, wire) {
      if (f.type === "message") {
        this.expect(wire, 2, f);
        const stop = this.length();
        return this.message(f.message, stop);
      }
      if (f.type === "string") {
        this.expect(wire, 2, f);
        const stop = this.length();
        const s = utf8Decode(this.buf.subarray(this.pos, stop));
        this.pos = stop;
        return s;
      }
      if (f.type === "bytes") {
        this.expect(wire, 2, f);
        const stop = this.length();
        const b = this.buf.slice(this.pos, stop);
        this.pos = stop;
        return b;
      }
      return this.scalar(f.type, wire);
    }
    scalar(type, wire) {
      if (wire === 5) {
        const v2 = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 4);
        this.pos += 4;
        return type === "float" ? v2.getFloat32(0, true) : type === "int32" ? v2.getInt32(0, true) : v2.getUint32(0, true);
      }
      if (wire === 1) {
        const v2 = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8);
        this.pos += 8;
        return type === "double" ? v2.getFloat64(0, true) : Number(v2.getBigInt64(0, true));
      }
      if (wire !== 0) throw Error(`${type}: unexpected wire type ${wire}`);
      const start = this.pos, b = this.buf;
      let small = 0, shift = 0;
      for (let i = 0; i < 4; i++) {
        if (this.pos >= b.length) throw Error("varint past the end");
        const byte = b[this.pos++];
        small += (byte & 127) * 2 ** shift;
        if (byte < 128) return type === "bool" ? small !== 0 : small;
        shift += 7;
      }
      this.pos = start;
      const v = this.varintBig();
      if (type === "bool") return v !== 0n;
      if (type === "int32" || type === "enum") return Number(BigInt.asIntN(32, v));
      if (type === "uint32") return Number(BigInt.asUintN(32, v));
      if (type === "int64") return Number(BigInt.asIntN(64, v));
      return Number(v);
    }
    expect(wire, want, f) {
      if (wire !== want) throw Error(`${f.name}: wire type ${wire}, expected ${want}`);
    }
    length() {
      const n = this.varint(), stop = this.pos + n;
      if (stop > this.buf.length) throw Error("length past the end");
      return stop;
    }
    varint() {
      let result = 0, shift = 0;
      for (; ; ) {
        if (this.pos >= this.buf.length) throw Error("varint past the end");
        const byte = this.buf[this.pos++];
        result += (byte & 127) * 2 ** shift;
        if (byte < 128) return result;
        shift += 7;
        if (shift > 49) throw Error("varint too long");
      }
    }
    varintBig() {
      let result = 0n, shift = 0n;
      for (; ; ) {
        if (this.pos >= this.buf.length) throw Error("varint past the end");
        const b = this.buf[this.pos++];
        result |= BigInt(b & 127) << shift;
        if (b < 128) return result;
        shift += 7n;
        if (shift > 63n) throw Error("varint too long");
      }
    }
    skip(wire) {
      if (wire === 0) this.varintBig();
      else if (wire === 1) this.pos += 8;
      else if (wire === 5) this.pos += 4;
      else if (wire === 2) this.pos = this.length();
      else throw Error(`cannot skip wire type ${wire}`);
    }
  };

  // src/core/tracker/cards.ts
  function dbSource(db) {
    const codeToId = /* @__PURE__ */ new Map();
    for (const c of Object.values(db)) {
      if (!c.exportCode || !c.inInventory) continue;
      if (!codeToId.has(c.exportCode) || c.id === c.baseId) codeToId.set(c.exportCode, c.id);
    }
    return { get: (id) => db[id], idOfCode: (code) => codeToId.get(code) };
  }
  var Cards = class {
    constructor(source) {
      __publicField(this, "src");
      this.src = typeof source.get === "function" && typeof source.idOfCode === "function" ? source : dbSource(source);
    }
    rec(id) {
      return this.src.get(id);
    }
    // GameData.MetaOf: inventory cards only, with the base card's data
    meta(id) {
      const c = this.rec(id);
      if (!c || !c.inInventory) return null;
      const b = this.rec(c.baseId) ?? c;
      return {
        BaseId: c.baseId,
        Name: b.name ?? b.label ?? "",
        Color: b.color ?? "",
        Cost: b.cost ?? -1,
        Category: b.category ?? 1,
        Unique: !!b.unique,
        Prophecy: !!b.prophecy,
        Avatar: !!b.avatar
      };
    }
    // GameData.InfoOf: the game's card data (tokens and bot cards too)
    info(id) {
      const c = this.rec(id);
      if (!c) return null;
      return { Name: c.infoName ?? "", Text: c.text ?? "", Avatar: !!c.infoAvatar, Cost: c.infoCost ?? 0, Colors: c.colors ?? "", Type: c.type ?? "" };
    }
    keyOf(cardId) {
      const m = this.meta(String(cardId));
      return m ? m.BaseId : String(cardId);
    }
    // MatchTracker.CardLabel (precomputed in the export)
    label(key) {
      const m = this.meta(key);
      if (m && m.Name.length > 0) return m.Name;
      const c = this.rec(key);
      return c?.label || c?.infoName || key;
    }
    baseAttribute(id, name) {
      const c = this.rec(id);
      if (!c) return -1;
      const v = name === "ManaCost" ? c.baseManaCost : name === "Attack" ? c.baseAttack : c.baseMaxHealth;
      return v ?? -1;
    }
    baseFlag(id, keyword) {
      return !!this.rec(id)?.baseFlags?.includes(keyword);
    }
    // GameData.DecodeDeckCode: base card -> copies, or null; unknown codes are skipped
    decodeDeckCode(text) {
      const code = (text ?? "").trim();
      if (code.length < 8 || !code.startsWith("SP")) return null;
      const cards = /* @__PURE__ */ new Map();
      let pos = 2, unknown = 0;
      const isCount = (ch) => ch >= "A" && ch <= "Z";
      for (let copies = 1; copies < 9 && pos + 1 < code.length && isCount(code[pos]) && isCount(code[pos + 1]); copies++) {
        const n = (code.charCodeAt(pos) - 65) * 26 + (code.charCodeAt(pos + 1) - 65);
        pos += 2;
        if (n < 0 || n > 100) return null;
        for (let i = 0; i < n; i++) {
          if (pos + 1 >= code.length) return null;
          const key = code.substr(pos, 2);
          pos += 2;
          let id = this.src.idOfCode(key);
          if (!id) {
            unknown += copies;
            continue;
          }
          id = this.meta(id)?.BaseId ?? id;
          cards.set(id, (cards.get(id) ?? 0) + copies);
        }
      }
      let name = "";
      if (pos < code.length && (code[pos] === "~" || code[pos] === ":")) name = code.slice(pos + 1).trim().replace(/:+$/, "").trim();
      return cards.size > 0 ? { cards, name, unknown } : null;
    }
  };

  // src/core/tracker/tracker.ts
  var OverlayRow = class {
    constructor() {
      __publicField(this, "Id", "");
      __publicField(this, "Name", "");
      __publicField(this, "Color", "");
      __publicField(this, "Cost", -1);
      __publicField(this, "Category", 1);
      __publicField(this, "Unique", false);
      __publicField(this, "Prophecy", false);
      __publicField(this, "Start", 0);
      __publicField(this, "Total", 0);
      __publicField(this, "Drawn", 0);
      __publicField(this, "Copies", 0);
      __publicField(this, "Gone", 0);
      __publicField(this, "Mods", "");
      __publicField(this, "Cap", Number.MAX_SAFE_INTEGER);
      __publicField(this, "Sure", 0);
      __publicField(this, "ArtId", "");
      __publicField(this, "Premium", false);
      __publicField(this, "Versions", /* @__PURE__ */ new Map());
      __publicField(this, "VersionDrawn", /* @__PURE__ */ new Map());
    }
    get RawRemaining() {
      return Math.max(0, this.Total - this.Drawn);
    }
    get Remaining() {
      return Math.min(this.Cap, Math.max(0, this.Total - this.Drawn));
    }
  };
  var ZoneAvatarBoard = 2;
  var ZoneDeck = 3;
  var ZoneHand = 4;
  var ZoneView = 15;
  var ZoneRemoveFromGame = 7;
  var ZoneDeathrattle = 17;
  var ZoneAvatarDeck = 10;
  var ZoneAvatarCemetery = 11;
  var ZoneHeroPowerBoard = 12;
  var ZoneTypeDeck = 2;
  var TypeFullCardRefresh = 30025;
  var TypeFullGameState = 11;
  var TypeGameEnd = 10002;
  var TypeTurnStart = 10005;
  var TypePlayCard = 10007;
  var TypeDrawForMulligan = 30072;
  var TypeCreateToken = 30005;
  var TypeTransformCard = 30018;
  var TypeChangeCard = 30050;
  var TypeRedrawForMulligan = 30073;
  var TypeAddToDiscard = 30077;
  var SubtypeColors = ["Strength", "Intelligence", "Willpower", "Agility", "Endurance"];
  var FirstColorSubtype = 9;
  var UnknownCard = "unknown";
  var KeywordAttributes = [28, 29, 30, 31, 46, 47, 48, 70];
  var KeywordEnum = ["Charge", "Taunt", "Cover", "Deathtouch", "Breakthrough", "Ward", "Regenerate", "Drain"];
  var KeywordShown = ["Charge", "Guard", "Cover", "Lethal", "Breakthrough", "Ward", "Regenerate", "Drain"];
  var AttrManaCost = 22;
  var AttrAttack = 24;
  var AttrMaxHealth = 25;
  var StatBuffText = /\+(\d+)\/\+(\d+)/;
  var CostChangeText = /costs?\s+(\d+)\s+(more|less)|([+-])(\d+)\s+(?:magicka\s+)?cost|(increase|raise|reduce|decrease|lower)s?\s+(?:its|their|the)?\s*cost\s+by\s+(\d+)/i;
  var inc = (m, k, by = 1) => m.set(k, (m.get(k) ?? 0) + by);
  var ordinal = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var Tracker = class {
    constructor(env, local) {
      __publicField(this, "env", env);
      __publicField(this, "local", local);
      __publicField(this, "lines", []);
      __publicField(this, "cards");
      __publicField(this, "settings");
      // deck
      __publicField(this, "deckRows", null);
      __publicField(this, "rowById", null);
      __publicField(this, "loadedDeckName", "");
      __publicField(this, "trackedTotal", 0);
      __publicField(this, "myCreatedRows", []);
      __publicField(this, "oppRows", []);
      __publicField(this, "currentVersion", "");
      // events
      __publicField(this, "uidZone", /* @__PURE__ */ new Map());
      __publicField(this, "uidKey", /* @__PURE__ */ new Map());
      __publicField(this, "drawnUid", /* @__PURE__ */ new Map());
      __publicField(this, "unknownLeftUid", /* @__PURE__ */ new Map());
      __publicField(this, "unknownLeftZone", /* @__PURE__ */ new Map());
      __publicField(this, "viewFromDeck", /* @__PURE__ */ new Map());
      __publicField(this, "unknownEntered", 0);
      __publicField(this, "serverDeckCount", -1);
      __publicField(this, "lastEventsDiff", Number.MIN_SAFE_INTEGER);
      __publicField(this, "maxEventsDiff", 0);
      __publicField(this, "eventsDiffChanges", 0);
      __publicField(this, "cardIds", /* @__PURE__ */ new Map());
      __publicField(this, "opponentSeen", /* @__PURE__ */ new Map());
      __publicField(this, "plays", []);
      __publicField(this, "nonDeckUid", /* @__PURE__ */ new Map());
      __publicField(this, "uidOwner", /* @__PURE__ */ new Map());
      __publicField(this, "opponentCreated", /* @__PURE__ */ new Map());
      __publicField(this, "myCreated", /* @__PURE__ */ new Map());
      __publicField(this, "myBanished", /* @__PURE__ */ new Map());
      __publicField(this, "oppBanished", /* @__PURE__ */ new Map());
      __publicField(this, "banishedUid", /* @__PURE__ */ new Map());
      __publicField(this, "goneUid", /* @__PURE__ */ new Map());
      __publicField(this, "firstCardId", /* @__PURE__ */ new Map());
      __publicField(this, "copyUid", /* @__PURE__ */ new Map());
      __publicField(this, "avatarUid", /* @__PURE__ */ new Map());
      __publicField(this, "changedSeen", /* @__PURE__ */ new Map());
      __publicField(this, "headerActor", 0);
      __publicField(this, "queueStartCount", -1);
      __publicField(this, "ownLeftInQueue", 0);
      __publicField(this, "ownEnteredInQueue", 0);
      __publicField(this, "oppFromDeck", []);
      __publicField(this, "queueTrace", []);
      __publicField(this, "diedToDiscard", /* @__PURE__ */ new Map());
      __publicField(this, "diedToDeathrattle", /* @__PURE__ */ new Map());
      __publicField(this, "traceDumps", 0);
      __publicField(this, "deckMods", /* @__PURE__ */ new Map());
      __publicField(this, "pastHistoryQueue", null);
      __publicField(this, "replayingPast", false);
      __publicField(this, "opponentUid", 0);
      __publicField(this, "opponentName", "");
      __publicField(this, "opponentHuman", false);
      __publicField(this, "opponentAiId", 0);
      __publicField(this, "opponentColors", []);
      __publicField(this, "firstPlayer", 0);
      __publicField(this, "turnStarts", 0);
      __publicField(this, "resumed", false);
      __publicField(this, "debugCommands", /* @__PURE__ */ new Map());
      __publicField(this, "liveEventsSeen", false);
      __publicField(this, "incrementalState", false);
      __publicField(this, "headerSeq", 0);
      __publicField(this, "buffedBy", /* @__PURE__ */ new Map());
      __publicField(this, "reconciled", 0);
      __publicField(this, "fakeUnknownUid", 0);
      __publicField(this, "fullStateInQueue", false);
      __publicField(this, "syncAfterState", false);
      __publicField(this, "serverCountVersion", 0);
      __publicField(this, "stateCountVersion", 0);
      __publicField(this, "selfReturnLevel", /* @__PURE__ */ new Map());
      __publicField(this, "selfReturnsByKey", /* @__PURE__ */ new Map());
      __publicField(this, "ownCost", /* @__PURE__ */ new Map());
      __publicField(this, "oppBackToHand", /* @__PURE__ */ new Map());
      __publicField(this, "oppBackToHandUid", /* @__PURE__ */ new Map());
      __publicField(this, "graveyardIssue", "");
      __publicField(this, "gameEnded", false);
      // opponent window
      __publicField(this, "oppDeck", null);
      __publicField(this, "oppDeckName", "");
      // snapshots
      __publicField(this, "lastSnapshot", [/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map()]);
      this.cards = env.cards;
      this.settings = { showLeft: false, countLeftOnly: false, artVersions: false, ...env.settings ?? {} };
    }
    setLocal(local) {
      if (local > 0) this.local = local;
    }
    // a full state in this queue pointed at a past history (the live adapter compares the Il2Cpp objects instead)
    get expectsPastHistory() {
      return this.pastHistoryQueue != null;
    }
    log(line) {
      this.lines.push(line);
      this.env.log?.(line);
    }
    label(key) {
      return this.cards.label(key);
    }
    keyOf(cardId) {
      return this.cards.keyOf(cardId);
    }
    // ---- deck rows (MatchTracker.Deck.cs) ----
    // The match deck as base card -> copies (LoadDeckRows with the replay's recorded deck).
    loadDeck(cards, name) {
      const rows = [], byId = /* @__PURE__ */ new Map();
      for (const [id, count] of cards) {
        if (count <= 0) continue;
        const meta = this.cards.meta(id);
        const baseId = meta ? meta.BaseId : id;
        let row = byId.get(baseId);
        if (!row) {
          row = this.newRow(baseId, meta && meta.Name.length > 0 ? meta.Name : id, meta);
          byId.set(baseId, row);
          rows.push(row);
        }
        row.Total += count;
        row.Start += count;
      }
      sortRows(rows);
      this.deckRows = rows;
      this.rowById = byId;
      this.loadedDeckName = name;
      this.resetEvents();
      this.publish();
    }
    newRow(id, name, meta) {
      const row = new OverlayRow();
      row.Id = id;
      row.Name = name;
      if (meta) {
        row.Color = meta.Color;
        row.Cost = meta.Cost;
        row.Category = meta.Category;
        row.Unique = meta.Unique;
        row.Prophecy = meta.Prophecy;
      } else {
        const info = this.cards.info(id);
        if (info) {
          row.Cost = info.Cost;
          row.Color = info.Colors;
          row.Category = info.Type.startsWith("Creature") ? 0 : info.Type.startsWith("Item") ? 3 : info.Type.startsWith("Support") ? 2 : 1;
        }
      }
      return row;
    }
    addRow(id, name, meta) {
      const row = this.newRow(id, name, meta);
      this.rowById.set(id, row);
      this.deckRows.push(row);
      sortRows(this.deckRows);
      return row;
    }
    versionLeft(row, delta) {
      if (row.Versions.size === 0) return;
      let pick = null;
      const count = row.Versions.get(this.currentVersion);
      if (count !== void 0) {
        const drawn = row.VersionDrawn.get(this.currentVersion) ?? 0;
        if (delta > 0 ? drawn < count : drawn > 0) pick = this.currentVersion;
      }
      if (pick == null)
        for (const [k, v] of row.Versions) {
          const drawn = row.VersionDrawn.get(k) ?? 0;
          if (delta > 0 ? drawn < v : drawn > 0) {
            pick = k;
            break;
          }
        }
      if (pick == null) return;
      row.VersionDrawn.set(pick, (row.VersionDrawn.get(pick) ?? 0) + delta);
    }
    publish() {
      if (!this.deckRows) return;
      this.publishDeckMods();
      const capped = this.unknownLeftUid.size > 0 && this.serverDeckCount >= 0;
      let sure = 0;
      if (capped) for (const row of this.deckRows) sure += Math.min(row.Sure, row.RawRemaining);
      const cap = capped ? Math.max(0, this.serverDeckCount - sure) : Number.MAX_SAFE_INTEGER;
      let remaining = 0;
      for (const row of this.deckRows) {
        row.Cap = capped ? Math.min(row.Sure, row.RawRemaining) + cap : Number.MAX_SAFE_INTEGER;
        remaining += row.RawRemaining;
      }
      this.trackedTotal = remaining;
      const created = [];
      for (const [key, n] of this.myCreated) {
        const row = this.newRow(key, this.label(key), this.cards.meta(key));
        row.Total = row.Drawn = n;
        row.Start = -1;
        created.push(row);
      }
      sortRows(created);
      this.myCreatedRows = created;
    }
    // ---- events (MatchTracker.Events.cs) ----
    resetCardEvents() {
      for (const m of [
        this.uidZone,
        this.uidKey,
        this.drawnUid,
        this.unknownLeftUid,
        this.unknownLeftZone,
        this.viewFromDeck,
        this.deckMods,
        this.selfReturnLevel,
        this.selfReturnsByKey,
        this.ownCost,
        this.buffedBy,
        this.cardIds,
        this.opponentSeen,
        this.oppBackToHand,
        this.oppBackToHandUid,
        this.nonDeckUid,
        this.uidOwner,
        this.opponentCreated,
        this.myCreated,
        this.myBanished,
        this.oppBanished,
        this.banishedUid,
        this.goneUid,
        this.firstCardId,
        this.copyUid,
        this.avatarUid,
        this.changedSeen
      ]) m.clear();
      this.unknownEntered = 0;
      this.reconciled = 0;
      this.lastEventsDiff = Number.MIN_SAFE_INTEGER;
      this.maxEventsDiff = this.eventsDiffChanges = this.traceDumps = 0;
      this.graveyardIssue = "";
      this.plays = [];
      this.headerActor = 0;
    }
    resetEvents() {
      this.resetCardEvents();
      this.lastSnapshot = [/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map()];
      this.serverDeckCount = -1;
      this.opponentUid = 0;
      this.opponentName = "";
      this.opponentHuman = false;
      this.opponentAiId = 0;
      this.opponentColors = [];
      this.firstPlayer = this.turnStarts = 0;
      this.resumed = false;
      this.liveEventsSeen = false;
      this.oppDeck = null;
      this.oppDeckName = "";
      this.oppRows = [];
    }
    // isPast: the live adapter's verdict that this queue is the reconnect's past history (same object as the full state's
    // HistoryQueue); without it the object identity decides, which a replay never matches (like the PC replay).
    processQueue(queue, isPast) {
      const local = this.local;
      if (local <= 0) {
        this.log("Events: local player id unknown");
        return;
      }
      this.queueStartCount = this.serverDeckCount;
      this.ownLeftInQueue = this.ownEnteredInQueue = 0;
      this.oppFromDeck = [];
      this.queueTrace = [];
      this.diedToDiscard.clear();
      this.diedToDeathrattle.clear();
      this.replayingPast = isPast ?? (this.pastHistoryQueue != null && queue === this.pastHistoryQueue);
      if (this.replayingPast) {
        this.pastHistoryQueue = null;
        this.log("Events: history before the reconnect, already in the game state (own deck not recounted)");
        try {
          this.processQueueItems(queue, local);
        } finally {
          this.replayingPast = false;
          this.oppFromDeck = [];
        }
        return;
      }
      this.processQueueItems(queue, local);
      let drop = this.queueStartCount >= 0 && this.serverDeckCount >= 0 ? this.queueStartCount - this.serverDeckCount - this.ownLeftInQueue + this.ownEnteredInQueue : 0;
      if (this.fullStateInQueue) drop = 0;
      if (drop !== 0 && this.oppFromDeck.length === 0 && this.traceDumps < 20) {
        this.traceDumps++;
        this.log(`Events: server deck changed by ${this.serverDeckCount - this.queueStartCount} but we saw ${this.ownLeftInQueue} left / ${this.ownEnteredInQueue} entered; card events: ${this.queueTrace.join("; ")}`);
      }
      this.resolveStolenFromDeck(local);
      if (drop !== 0 && this.oppFromDeck.length === 0) this.reconcile(drop);
      if (!this.fullStateInQueue) this.liveEventsSeen = true;
      this.fullStateInQueue = false;
    }
    reconcile(drop) {
      this.reconciled += Math.abs(drop);
      if (drop < 0) {
        this.unknownEntered += -drop;
        this.log(`Events: ${-drop} card(s) entered the deck without an event, counted as unknown`);
        return;
      }
      for (let i = 0; i < drop; i++) {
        const fake = --this.fakeUnknownUid;
        this.unknownLeftUid.set(fake, true);
        this.unknownLeftZone.set(fake, -1);
      }
      this.log(`Events: ${drop} card(s) left the deck without an event, counted as unknown`);
    }
    processQueueItems(queue, local) {
      for (const item of queue?.Queue ?? []) {
        if (!item) continue;
        const type = item.Type;
        if (type === TypeFullGameState && this.replayingPast) {
          this.log("Events: old game state in the reconnect history skipped");
          continue;
        }
        if (type === TypeFullGameState) {
          this.applyFullGameState(item.FullGameState, local);
          continue;
        }
        for (const player of item.MatchIntroPlayers ?? []) if (player) this.onIntroPlayer(player, local);
        const acting = item.ActingPlayerInstanceId;
        if (type === TypeTurnStart && !this.replayingPast) {
          this.turnStarts++;
          if (this.firstPlayer === 0) this.firstPlayer = acting;
        } else if (type === TypePlayCard) this.plays.push([acting, item.ActorCardNetUid]);
        for (const player of item.AffectedPlayersArray ?? []) {
          if (!player || !player.ValidDeckCount) continue;
          if (player.PlayerUid === local) {
            this.serverDeckCount = player.DeckCardCount;
            this.serverCountVersion++;
          }
        }
        if (type >= 1e4 && type < 2e4) {
          this.headerActor = item.ActorCardNetUid;
          this.headerSeq++;
        } else if (type === 2e4) this.headerActor = 0;
        const typeName = String(type);
        for (const card of item.AffectedCardsArray ?? []) if (card) this.onHistoryCard(card, type, typeName, local);
        if (type === TypeGameEnd && !this.replayingPast) this.onGameEnd();
      }
    }
    onIntroPlayer(player, local) {
      const uid = player.PlayerInstanceId;
      if (uid === 0 || uid === local) return;
      this.opponentUid = uid;
      this.opponentName = player.PlayerName ?? "";
      this.opponentHuman = !!player.IsHuman;
      this.opponentAiId = player.AiOpponentId;
      this.opponentColors = [];
      for (const value of player.DeckColorNames ?? []) {
        const index = value - FirstColorSubtype;
        if (index >= 0 && index < SubtypeColors.length && !this.opponentColors.includes(SubtypeColors[index])) this.opponentColors.push(SubtypeColors[index]);
      }
      this.opponentColors.sort(ordinal);
      this.onOpponentKnown();
      this.log(`Events: opponent '${this.opponentName}' (${this.opponentHuman ? "human" : "AI"}) colors ${this.opponentColors.join("/")}`);
    }
    onHistoryCard(card, type, typeName, local) {
      const uid = card.CardNetUid;
      const position = card.CurrentPosition;
      if (uid === 0 || !position) return;
      const owner = position.OwningPlayerUid;
      const zone = position.GameZoneName;
      const cardId = card.CardId;
      if (cardId !== 0) this.cardIds.set(uid, cardId);
      if (this.queueTrace.length < 40)
        this.queueTrace.push(`${typeName} uid=${uid} owner=${owner === local ? "me" : owner} zone=${zone} prev=${card.PreviousGameZoneType} card=${cardId !== 0 ? this.label(this.keyOf(cardId)) : "?"} creator=${card.CreatorCardId}`);
      if (zone === ZoneAvatarBoard || zone === ZoneAvatarDeck || zone === ZoneAvatarCemetery || zone === ZoneHeroPowerBoard) {
        this.avatarUid.set(uid, true);
        return;
      }
      if (this.avatarUid.has(uid)) return;
      if (cardId !== 0) {
        const avatarInfo = this.cards.info(String(cardId));
        if (avatarInfo && (avatarInfo.Avatar || avatarInfo.Name === "Avatar")) {
          this.avatarUid.set(uid, true);
          return;
        }
      }
      if (zone === ZoneRemoveFromGame && !this.banishedUid.has(uid)) {
        this.banishedUid.set(uid, true);
        const banished = cardId !== 0 ? this.keyOf(cardId) : UnknownCard;
        inc(owner === local ? this.myBanished : this.oppBanished, banished);
        this.log(`Events: banished ${owner === local ? "own " : "opponent "}${this.label(banished)} uid=${uid} (${typeName})`);
      }
      let changed = false;
      if (cardId !== 0) {
        const firstId = this.firstCardId.get(uid);
        if (firstId === void 0) {
          this.firstCardId.set(uid, cardId);
          const actorId = this.cardIds.get(this.headerActor);
          if (this.headerActor !== 0 && this.headerActor !== uid && this.nonDeckUid.has(this.headerActor) && actorId === cardId) this.nonDeckUid.set(uid, true);
        } else if (firstId !== cardId) changed = true;
      }
      const creator = card.CreatorCardId;
      const previousOwner = this.uidOwner.get(uid);
      const stolen = previousOwner !== void 0 && previousOwner !== owner;
      this.uidOwner.set(uid, owner);
      if (creator !== 0 || stolen || changed || type === TypeTransformCard || type === TypeChangeCard || this.nonDeckUid.has(uid)) {
        const first = !this.nonDeckUid.has(uid);
        this.nonDeckUid.set(uid, true);
        const count = cardId !== 0 && (first && (type === TypeCreateToken || stolen || type === TypeTransformCard || type === TypeChangeCard) || changed && !this.changedSeen.has(`${uid}:${cardId}`));
        if (changed) this.changedSeen.set(`${uid}:${cardId}`, true);
        const how = `${typeName}${stolen ? ", stolen" : changed ? ", changed" : ""}`;
        if (owner !== local) {
          if (count) {
            const created = this.keyOf(cardId);
            inc(this.opponentCreated, created);
            this.log(`Events: opponent non-deck card ${this.label(created)} uid=${uid} (${how})`);
          }
          if (stolen && previousOwner === local) {
            const mine = this.uidKey.get(uid);
            if (mine !== void 0) this.markGone(uid, mine, "stolen by the opponent");
          }
          return;
        }
        if (count) {
          const created = this.keyOf(cardId);
          inc(this.myCreated, created);
          this.log(`Events: own non-deck card ${this.label(created)} uid=${uid} (${how})`);
        }
      }
      if (owner !== local) {
        const previousZoneType = card.PreviousGameZoneType;
        if (zone === ZoneHand && cardId !== 0 && type !== TypeFullGameState && !this.replayingPast && previousZoneType !== 0 && (previousZoneType & ZoneTypeDeck) === 0 && !this.oppBackToHandUid.has(uid)) {
          this.oppBackToHandUid.set(uid, true);
          const back = this.keyOf(cardId);
          inc(this.oppBackToHand, back);
          this.log(`Events: opponent card ${this.label(back)} uid=${uid} back to hand (${typeName}, from zone type ${previousZoneType})`);
        }
        if (cardId !== 0 && type !== TypeFullGameState && !this.replayingPast && (card.PreviousGameZoneType & ZoneTypeDeck) !== 0) {
          this.oppFromDeck.push([uid, cardId, typeName]);
          return;
        }
        if (cardId !== 0) {
          const seen = this.keyOf(cardId);
          if (!this.opponentSeen.has(seen)) {
            this.opponentSeen.set(seen, true);
            this.log(`Events: opponent card ${this.label(seen)} uid=${uid} (${typeName})`);
          }
        }
        return;
      }
      if (this.replayingPast) return;
      this.rememberCost(card, uid);
      let key;
      if (cardId !== 0 && !changed) {
        key = this.keyOf(cardId);
        this.uidKey.set(uid, key);
        if (this.unknownLeftUid.delete(uid)) {
          this.unknownLeftZone.delete(uid);
          this.markLeft(uid, key, "identified later");
        }
      } else key = this.uidKey.get(uid);
      const lastZone = this.uidZone.get(uid);
      const known = lastZone !== void 0;
      const wasInDeck = known ? lastZone === ZoneDeck || lastZone === ZoneView && this.viewFromDeck.has(uid) : (card.PreviousGameZoneType & ZoneTypeDeck) !== 0 || type === TypeDrawForMulligan || type === TypeRedrawForMulligan || type === TypeFullGameState && creator === 0 && !this.incrementalState;
      const inDeck = zone === ZoneDeck || zone === ZoneView && wasInDeck;
      if (zone === ZoneView && wasInDeck) this.viewFromDeck.set(uid, true);
      else this.viewFromDeck.delete(uid);
      if (type === TypeFullCardRefresh && (!known || lastZone === zone)) {
        this.uidZone.set(uid, zone);
        if (inDeck && key !== void 0) this.readDeckMods(card, uid, key, type, typeName, false);
        return;
      }
      this.uidZone.set(uid, zone);
      if (inDeck && key !== void 0) this.readDeckMods(card, uid, key, type, typeName, !wasInDeck);
      if (zone === ZoneRemoveFromGame && creator === 0 && !this.nonDeckUid.has(uid) && key !== void 0) this.markGone(uid, key, "banished");
      if (wasInDeck && !inDeck && key !== void 0 && (zone === ZoneDeathrattle || type === TypeAddToDiscard) && this.secondDeathFromDeck(key, zone === ZoneDeathrattle)) {
        this.log(`Events: ${this.label(key)} uid=${uid} (${typeName}) is the same card destroyed in the deck, not counted again`);
        return;
      }
      if (wasInDeck && !inDeck) this.ownLeftInQueue++;
      else if (!wasInDeck && inDeck) this.ownEnteredInQueue++;
      const fullRow = key !== void 0 ? this.rowById.get(key) : void 0;
      if (wasInDeck && !inDeck && type === TypeFullGameState && key !== void 0 && fullRow && fullRow.Drawn >= fullRow.Total) {
        this.nonDeckUid.set(uid, true);
        inc(this.myCreated, key);
        this.log(`Events: own ${this.label(key)} uid=${uid} counted as a copy (more outside the deck than in the deck list)`);
        return;
      }
      this.currentVersion = `${cardId}|${card.IsPremium ? "1" : "0"}`;
      if (wasInDeck && !inDeck) {
        if (key !== void 0 && type !== TypeFullGameState) this.verifyPrediction(card, key, zone === ZoneHand ? "drawn" : "left the deck");
        if (key !== void 0) this.markLeft(uid, key, `${typeName} -> ${position.GameZoneName}`, creator !== 0);
        else {
          this.unknownLeftUid.set(uid, true);
          this.unknownLeftZone.set(uid, zone);
          for (const r of this.deckRows) r.Sure = 0;
          this.log(`Events: unknown card left the deck uid=${uid} (${typeName} -> ${zone})`);
        }
      } else if (!wasInDeck && inDeck) {
        if (!known && key === void 0 && this.turnStarts === 0) return;
        this.enteredDeck(uid, key, typeName, card.CreatorCardId);
      }
    }
    rememberCost(card, uid) {
      const names = card.AffectedAttributeName ?? [], values = card.AffectedAttributeValue ?? [];
      if (names.length !== values.length) return;
      for (let i = 0; i < names.length; i++) if (names[i] === AttrManaCost) {
        this.ownCost.set(uid, values[i]);
        return;
      }
    }
    readDeckMods(card, uid, key, type, typeName, entering) {
      const names = card.AffectedAttributeName ?? [], values = card.AffectedAttributeValue ?? [];
      if (names.length === 0 || names.length !== values.length) {
        const buff = type === 30016 || type === 30079 || type === 30048 || type === 30083;
        if (!buff && !(entering && type !== TypeCreateToken && type !== TypeFullGameState)) return;
        const actorId = this.cardIds.get(this.headerActor);
        if (this.headerActor === 0 || actorId === void 0) return;
        const actor = this.cards.info(String(actorId));
        if (!actor) return;
        const text = actor.Text.replace(/<[^>]+>/g, "");
        const self = this.keyOf(actorId) === key;
        if (self && (!entering || text.toLowerCase().indexOf("deck") < 0)) return;
        const m = StatBuffText.exec(text);
        const c = self ? CostChangeText.exec(text) : null;
        if (!m && !c) {
          if (entering) this.log(`Events: deck card ${this.label(key)} uid=${uid} entered via ${actor.Name} (${typeName}), no change found in its text`);
          return;
        }
        let costDelta = 0;
        if (c) {
          if (c[1] !== void 0) costDelta = Number(c[1]) * (c[2].toLowerCase() === "less" ? -1 : 1);
          else if (c[4] !== void 0) costDelta = Number(c[4]) * (c[3] === "-" ? -1 : 1);
          else {
            const verb = c[5].toLowerCase();
            costDelta = Number(c[6]) * (verb === "increase" || verb === "raise" ? 1 : -1);
          }
        }
        let level = 1;
        if (self) {
          let prev = -1;
          const baseCostNow = this.cards.baseAttribute(key, "ManaCost");
          const lastCost = this.ownCost.get(this.headerActor);
          if (costDelta !== 0 && baseCostNow >= 0 && lastCost !== void 0) prev = Math.max(0, Math.trunc((lastCost - baseCostNow) / costDelta));
          const saved = this.selfReturnLevel.get(this.headerActor);
          if (prev < 0 && saved !== void 0) prev = saved;
          const selfRow = this.rowById.get(key);
          if (prev < 0 && selfRow && selfRow.Total - selfRow.Copies <= 1) prev = this.selfReturnsByKey.get(key) ?? 0;
          level = Math.max(0, prev) + 1;
          this.selfReturnLevel.set(uid, level);
          this.selfReturnsByKey.set(key, level);
        }
        const found = [];
        if (c) {
          const baseCostNow = this.cards.baseAttribute(key, "ManaCost");
          if (baseCostNow >= 0) found.push(`cost ${Math.max(0, baseCostNow + costDelta * level)}`);
        }
        if (m) found.push(`+${Number(m[1]) * level}/+${Number(m[2]) * level}`);
        let inferred = found.join(", ");
        if (self) {
          if (this.deckMods.get(uid) === inferred) return;
          this.deckMods.set(uid, inferred);
        } else {
          if (this.buffedBy.get(uid) === this.headerSeq) return;
          this.buffedBy.set(uid, this.headerSeq);
          this.deckMods.set(uid, addStats(this.deckMods.get(uid), inferred));
          inferred = this.deckMods.get(uid);
        }
        this.log(`Events: deck card ${this.label(key)} uid=${uid} modified: ${inferred} (from the text of ${actor.Name}, ${typeName}${self ? `, return ${level}` : ""})`);
        return;
      }
      const label = this.attributeLabel(names, values, key);
      if (this.deckMods.get(uid) === label) return;
      if (label.length === 0) {
        this.deckMods.delete(uid);
        return;
      }
      this.deckMods.set(uid, label);
      this.log(`Events: deck card ${this.label(key)} uid=${uid} modified: ${label}`);
    }
    attributeLabel(names, values, id) {
      const attributes = /* @__PURE__ */ new Map();
      for (let i = 0; i < names.length; i++) attributes.set(names[i], values[i]);
      const parts = [];
      const baseCost = this.cards.baseAttribute(id, "ManaCost");
      const cost = attributes.get(AttrManaCost);
      if (cost !== void 0 && baseCost >= 0 && cost !== baseCost) parts.push(`cost ${cost}`);
      const baseAttack = this.cards.baseAttribute(id, "Attack"), baseHealth = this.cards.baseAttribute(id, "MaxHealth");
      let attack = attributes.get(AttrAttack), health = attributes.get(AttrMaxHealth);
      if ((attack !== void 0 || health !== void 0) && baseAttack >= 0 && baseHealth >= 0) {
        if (attack === void 0) attack = baseAttack;
        if (health === void 0) health = baseHealth;
        if (attack !== baseAttack || health !== baseHealth)
          parts.push(`${attack - baseAttack >= 0 ? "+" : ""}${attack - baseAttack}/${health - baseHealth >= 0 ? "+" : ""}${health - baseHealth}`);
      }
      for (let k = 0; k < KeywordAttributes.length; k++) {
        const value = attributes.get(KeywordAttributes[k]);
        if (value !== void 0 && value > 0 && !this.cards.baseFlag(id, KeywordEnum[k])) parts.push(KeywordShown[k]);
      }
      return parts.join(", ");
    }
    verifyPrediction(card, key, how) {
      const names = card.AffectedAttributeName ?? [], values = card.AffectedAttributeValue ?? [];
      if (names.length !== values.length) {
        const predicted = this.predictedDeckUids(key);
        const r = this.rowById.get(key);
        const left = r ? r.RawRemaining - 1 : 0;
        if (predicted.length > 0 && predicted.length > left) this.uidZone.set(predicted[0], ZoneHand);
        return;
      }
      const actual = modCore(this.attributeLabel(names, values, key));
      const modified = this.predictedDeckUids(key);
      let matched = 0;
      for (const u of modified) if (modCore(this.deckMods.get(u)) === actual) {
        matched = u;
        break;
      }
      const row = this.rowById.get(key);
      const remaining = row ? row.RawRemaining : 0;
      if (matched !== 0) {
        this.uidZone.set(matched, ZoneHand);
        this.log(`MODCHECK ok: ${this.label(key)} ${how} as '${actual}' as predicted (deck uid ${matched})`);
        return;
      }
      if (actual.length === 0) {
        if (modified.length > 0 && modified.length >= remaining)
          this.log(`MODCHECK MISMATCH: ${this.label(key)} ${how} unmodified, predicted only ${this.predictedLabels(modified)}`);
        return;
      }
      this.log(`MODCHECK MISMATCH: ${this.label(key)} ${how} as '${actual}', predicted ${modified.length > 0 ? this.predictedLabels(modified) : "no change"}`);
      if (modified.length > 0) this.uidZone.set(modified[0], ZoneHand);
    }
    predictedDeckUids(key) {
      const uids = [];
      for (const [uid, zone] of this.uidZone) {
        const mod = this.deckMods.get(uid);
        if (zone === ZoneDeck && this.uidKey.get(uid) === key && mod !== void 0 && modCore(mod).length > 0) uids.push(uid);
      }
      return uids;
    }
    predictedLabels(uids) {
      return uids.map((u) => `'${modCore(this.deckMods.get(u))}'`).join(", ");
    }
    publishDeckMods() {
      const byRow = this.deckModsByRow();
      for (const row of this.deckRows) {
        const counts = byRow.get(row.Id);
        row.Mods = counts ? [...counts].map(([label, n]) => `${n}x ${label}`).join("; ") : "";
      }
    }
    deckModsByRow() {
      const byRow = /* @__PURE__ */ new Map();
      for (const [uid, label] of this.deckMods) {
        const key = this.uidKey.get(uid);
        if (this.uidZone.get(uid) !== ZoneDeck || key === void 0) continue;
        let counts = byRow.get(key);
        if (!counts) byRow.set(key, counts = /* @__PURE__ */ new Map());
        inc(counts, label);
      }
      return byRow;
    }
    secondDeathFromDeck(key, deathrattle) {
      const other = deathrattle ? this.diedToDiscard : this.diedToDeathrattle;
      const mine = deathrattle ? this.diedToDeathrattle : this.diedToDiscard;
      const n = other.get(key) ?? 0;
      if (n > 0) {
        other.set(key, n - 1);
        return true;
      }
      inc(mine, key);
      return false;
    }
    resolveStolenFromDeck(_local) {
      if (this.oppFromDeck.length === 0) return;
      let stolen = this.queueStartCount >= 0 && this.serverDeckCount >= 0 ? this.queueStartCount - this.serverDeckCount - this.ownLeftInQueue + this.ownEnteredInQueue : 0;
      this.oppFromDeck.sort((a, b) => this.inOurDeck(b[1]) - this.inOurDeck(a[1]));
      for (const [uid, cardId, typeName] of this.oppFromDeck) {
        const key = this.keyOf(cardId);
        if (stolen > 0 && this.inOurDeck(cardId) > 0) {
          stolen--;
          this.nonDeckUid.set(uid, true);
          inc(this.opponentCreated, key);
          this.markLeft(uid, key, "stolen from the deck by the opponent");
          this.markGone(uid, key, "stolen from the deck");
          continue;
        }
        if (!this.opponentSeen.has(key)) {
          this.opponentSeen.set(key, true);
          this.log(`Events: opponent card ${this.label(key)} uid=${uid} (${typeName}, from the deck)`);
        }
      }
      if (stolen > 0) this.log(`Events: ${stolen} card(s) left our deck to the opponent without a known identity`);
      this.oppFromDeck = [];
    }
    inOurDeck(cardId) {
      return this.rowById?.get(this.keyOf(cardId))?.RawRemaining ?? 0;
    }
    markGone(uid, key, how) {
      if (this.goneUid.has(uid)) return;
      this.goneUid.set(uid, true);
      const row = this.rowById.get(key);
      if (!row) return;
      if (row.Gone < row.Total) row.Gone++;
      this.log(`Events: x ${this.label(key)} uid=${uid} (${how}), gone ${row.Gone}/${row.Total}`);
    }
    markLeft(uid, key, how, copy = false) {
      let row = this.rowById.get(key);
      if (!row) {
        if (this.unknownEntered === 0) {
          this.log(`Events: ignored ${this.label(key)} uid=${uid} (${how}): not in the deck list`);
          if (this.ownLeftInQueue > 0) this.ownLeftInQueue--;
          return;
        }
        row = this.addRow(key, this.label(key), this.cards.meta(key));
        row.Total++;
        if (this.unknownEntered > 0) this.unknownEntered--;
      }
      row.Drawn++;
      this.versionLeft(row, 1);
      if (row.Sure > 0) row.Sure--;
      if ((copy || this.copyUid.has(uid)) && row.Copies > 0) row.Copies--;
      if (row.Copies > row.RawRemaining) row.Copies = row.RawRemaining;
      this.drawnUid.set(uid, key);
      this.log(`Events: - ${this.label(key)} uid=${uid} (${how}) now ${row.RawRemaining}/${row.Total}`);
    }
    enteredDeck(uid, key, typeName, creator) {
      const drawnKey = this.drawnUid.get(uid);
      if (drawnKey !== void 0) {
        this.drawnUid.delete(uid);
        const back = this.rowById.get(drawnKey);
        if (back && back.Drawn > 0) {
          back.Drawn--;
          this.versionLeft(back, -1);
          if (this.unknownLeftUid.size > 0) back.Sure++;
          if (this.copyUid.has(uid)) back.Copies++;
        }
        this.log(`Events: + returned ${this.label(drawnKey)} uid=${uid} (${typeName})${back ? ` now ${back.RawRemaining}/${back.Total}` : ""}`);
        return;
      }
      if (key === void 0) {
        this.unknownEntered++;
        this.log(`Events: + unknown card entered the deck uid=${uid} (${typeName})`);
        return;
      }
      let row = this.rowById.get(key);
      if (creator === 0 && row && row.Drawn > 0) {
        row.Drawn--;
        this.versionLeft(row, -1);
        if (this.unknownLeftUid.size > 0) row.Sure++;
        this.log(`Events: + returned ${this.label(key)} uid=${uid} (${typeName}, new uid) now ${row.RawRemaining}/${row.Total}`);
        return;
      }
      if (!row) row = this.addRow(key, this.label(key), this.cards.meta(key));
      row.Total++;
      if (this.unknownLeftUid.size > 0) row.Sure++;
      row.Copies++;
      this.copyUid.set(uid, true);
      this.log(`Events: + shuffled in ${this.label(key)} uid=${uid} (${typeName}) now ${row.RawRemaining}/${row.Total}`);
    }
    stateCards(state) {
      const out = [];
      for (const player of state?.PlayerStates ?? [])
        for (const zones of [player.StaticGameZones, player.DynamicGameZones])
          for (const zone of zones ?? [])
            for (const lane of zone.Lanes ?? [])
              for (const card of lane.Cards ?? []) if (card) out.push(card);
      return out;
    }
    applyFullGameState(state, local) {
      if (!state) return;
      if (this.liveEventsSeen && this.debugCommands.size > 0) {
        this.pastHistoryQueue = state.HistoryQueue;
        this.fullStateInQueue = true;
        this.syncAfterState = true;
        this.stateCountVersion = this.serverCountVersion;
        let seenCards = 0;
        this.incrementalState = true;
        try {
          for (const card of this.stateCards(state)) {
            this.onHistoryCard(card, TypeFullGameState, "FullGameState", local);
            seenCards++;
          }
        } finally {
          this.incrementalState = false;
        }
        this.publish();
        this.log(`Events: full game state during the match (${seenCards} cards), checked against the tracking, deck not recounted`);
        return;
      }
      const keep = [];
      for (const row of this.deckRows) {
        if (row.Start <= 0) {
          this.rowById.delete(row.Id);
          continue;
        }
        row.Total = row.Start;
        row.Drawn = 0;
        row.Gone = 0;
        row.Copies = 0;
        keep.push(row);
      }
      this.deckRows = keep;
      this.resetCardEvents();
      if (!state.DuringMulligan && this.turnStarts === 0) {
        this.turnStarts = 1;
        if (this.firstPlayer === 0) {
          this.resumed = true;
          this.firstPlayer = -1;
        }
      }
      this.pastHistoryQueue = state.HistoryQueue;
      this.fullStateInQueue = true;
      this.syncAfterState = true;
      this.stateCountVersion = this.serverCountVersion;
      let cards = 0, inDeck = 0;
      for (const card of this.stateCards(state)) {
        this.onHistoryCard(card, TypeFullGameState, "FullGameState", local);
        cards++;
        const position = card.CurrentPosition;
        if (position && position.OwningPlayerUid === local && position.GameZoneName === ZoneDeck) inDeck++;
      }
      this.publish();
      if (inDeck > this.trackedTotal) {
        this.unknownEntered += inDeck - this.trackedTotal;
        this.log(`Events: ${inDeck - this.trackedTotal} card(s) in the deck not in the deck list (shuffled in before the reconnect)`);
      }
      this.log(`Events: full game state received (${cards} cards, ${inDeck} in our deck), deck recounted from the board`);
    }
    onGameEnd() {
      if (this.gameEnded) return;
      this.gameEnded = true;
      this.publish();
      this.logWindowSnapshot(true);
      this.logCheck();
    }
    // ---- opponent (MatchTracker.Opponent.cs) ----
    onOpponentKnown() {
      if (this.opponentHuman) return;
      const lookup = botLookup(this.env.bots, this.opponentAiId, this.env.scenario ?? "");
      if (lookup) {
        this.oppDeck = /* @__PURE__ */ new Map();
        for (const [id, n] of lookup.cards) {
          const key = /^-?\d+$/.test(id) ? this.keyOf(Number(id)) : id;
          inc(this.oppDeck, key, n);
        }
        this.oppDeckName = lookup.name.length > 0 ? lookup.name : "Bot deck";
        this.log(`Opponent: bot deck from tesl-decks.com: '${this.oppDeckName}' (${this.oppDeck.size} different cards)`);
      }
      this.refreshOpponent();
    }
    opponentSeenCounts() {
      const counts = /* @__PURE__ */ new Map();
      for (const key of this.opponentSeen.keys()) counts.set(key, 1);
      const played = /* @__PURE__ */ new Map();
      const counted = /* @__PURE__ */ new Set();
      for (const [player, uid] of this.plays) {
        const cardId = this.cardIds.get(uid);
        if (player !== this.opponentUid || this.nonDeckUid.has(uid) || cardId === void 0) continue;
        if (counted.has(uid)) continue;
        counted.add(uid);
        inc(played, this.keyOf(cardId));
      }
      for (const [key, n] of played) {
        const copies = n - (this.oppBackToHand.get(key) ?? 0);
        counts.set(key, Math.max(Math.max(1, copies), counts.get(key) ?? 0));
      }
      return counts;
    }
    refreshOpponent() {
      const seen = this.opponentSeenCounts();
      const rows = [];
      if (this.oppDeck) {
        for (const [key, n] of this.oppDeck) {
          const row = this.newRow(key, this.label(key), this.cards.meta(key));
          row.Total = row.Start = n;
          row.Drawn = Math.min(n, seen.get(key) ?? 0);
          rows.push(row);
        }
        for (const [key, n] of seen) {
          if (this.oppDeck.has(key)) continue;
          const row = this.newRow(key, this.label(key), this.cards.meta(key));
          row.Total = row.Drawn = n;
          row.Start = 0;
          rows.push(row);
        }
      } else {
        for (const [key, n] of seen) {
          const row = this.newRow(key, this.label(key), this.cards.meta(key));
          row.Total = row.Drawn = n;
          row.Start = -1;
          rows.push(row);
        }
      }
      sortRows(rows);
      this.oppRows = rows;
    }
    // ---- window contents (Picker.cs DeckEntries, Native.cs WindowEntries) ----
    countText(left, total) {
      if (total <= 1) return "";
      return this.settings.countLeftOnly ? String(left) : `${left}/${total}`;
    }
    // { key, available, mod, label }
    deckEntries() {
      const mods = this.deckModsByRow();
      const entries = [];
      for (const row of this.deckRows) {
        let left = row.Remaining, carved = 0;
        const byLabel = mods.get(row.Id);
        if (byLabel)
          for (const [label, count] of byLabel) {
            const n = Math.min(count, left);
            if (n <= 0) continue;
            entries.push([row.Id, true, label, n > 1 ? String(n) : ""]);
            left -= n;
            carved += n;
          }
        if (this.settings.artVersions && row.Versions.size > 1) {
          for (const [version, count] of row.Versions) {
            const drawn = row.VersionDrawn.get(version) ?? 0;
            const vLeft = Math.max(0, Math.min(count - drawn, left));
            if (vLeft <= 0 && !this.settings.showLeft) continue;
            entries.push([row.Id, vLeft > 0, "", this.countText(vLeft, count)]);
          }
        } else {
          const total = Math.max(left, row.Total - carved);
          if (total <= 0 || left <= 0 && !this.settings.showLeft) continue;
          entries.push([row.Id, left > 0, "", this.countText(left, total)]);
        }
      }
      return entries;
    }
    oppEntries() {
      const entries = [];
      for (const row of this.oppRows) {
        if (row.Start > 0) {
          if (row.Remaining <= 0 && !this.settings.showLeft) continue;
          entries.push([row.Id, row.Remaining > 0, "", this.countText(row.Remaining, row.Start)]);
        } else entries.push([row.Id, true, "", row.Total > 1 ? `x${row.Total}` : "seen"]);
      }
      return entries;
    }
    // The cards a window shows as (card id, copies): the deck's remaining copies; the opponent's remaining copies of a
    // known deck, otherwise the cards seen (as often as played). Feeds the game's own card list on the phone.
    // The third value is the label the PC shows in the count's place ("left/total", "x2", "seen"; "" for single copies).
    windowCards(side) {
      const out = [];
      if (side === "deck") {
        for (const row of this.deckRows ?? []) if (row.Remaining > 0) out.push([row.Id, row.Remaining, this.countText(row.Remaining, row.Total)]);
      } else {
        for (const row of this.oppRows) {
          if (row.Start > 0) {
            if (row.Remaining > 0) out.push([row.Id, row.Remaining, this.countText(row.Remaining, row.Start)]);
          } else if (row.Total > 0) out.push([row.Id, row.Total, row.Total > 1 ? `x${row.Total}` : "seen"]);
        }
      }
      return out;
    }
    // ---- log checks (Replay.cs LogWindowSnapshot, Events.cs LogCheck) ----
    logWindowSnapshot(full) {
      if (!this.deckRows || !this.rowById) return;
      for (let side = 0; side < 2; side++) {
        const entries = side === 0 ? this.deckEntries() : this.oppEntries();
        const now = /* @__PURE__ */ new Map(), order = [];
        for (const [key, available, mod, label] of entries) {
          const name = this.label(key) + (mod.length > 0 ? ` [${mod}]` : "");
          let unique = name;
          for (let n = 2; now.has(unique); n++) unique = `${name} #${n}`;
          now.set(unique, (label.length > 0 ? label : "-") + (available ? "" : " grey"));
          order.push(unique);
        }
        const title = side === 0 ? "UI deck" : "UI opp";
        if (full) this.log(`${title} (all ${order.length}): ${order.map((k) => `${k} ${now.get(k)}`).join("; ")}`);
        else {
          const before = this.lastSnapshot[side], changes = [];
          for (const key of order) {
            const old = before.get(key);
            if (old === void 0) changes.push(`+${key} ${now.get(key)}`);
            else if (old !== now.get(key)) changes.push(`${key} ${old}->${now.get(key)}`);
          }
          for (const key of before.keys()) if (!now.has(key)) changes.push(`-${key}`);
          if (before.size === 0 && order.length > 0) this.log(`${title}: ${order.length} rows`);
          else if (changes.length > 0) this.log(`${title}: ${changes.join("; ")}`);
        }
        this.lastSnapshot[side] = now;
      }
    }
    logCheck() {
      const warn = [], info = [];
      if (this.deckRows && this.rowById) {
        this.publish();
        const tracked = this.trackedTotal + this.unknownEntered - this.unknownLeftUid.size;
        const final = this.serverDeckCount >= 0 ? tracked - this.serverDeckCount : 0;
        const deck = `deck diff ${final} (max ${this.maxEventsDiff}, ${this.eventsDiffChanges}x)`;
        if (final !== 0 || this.maxEventsDiff > 1) warn.push(deck);
        else info.push(deck);
        if (this.unknownLeftUid.size > 0) warn.push(`${this.unknownLeftUid.size} unknown left`);
        const bad = [];
        for (const row of this.deckRows)
          if (row.Drawn > row.Total || row.Copies > row.Total || row.Copies < 0) bad.push(`${row.Name} ${row.Drawn}/${row.Total}+${row.Copies}`);
        if (bad.length > 0) warn.push(`own rows: ${bad.join(", ")}`);
      } else warn.push("no deck loaded");
      if (this.graveyardIssue.length > 0) warn.push(`graveyard: ${this.graveyardIssue}`);
      if (this.reconciled > 0) info.push(`reconciled ${this.reconciled}`);
      const seen = this.opponentSeenCounts();
      const avatar = [], many = [], outside = [];
      for (const [key, n] of seen) {
        const meta = this.cards.meta(key);
        const name = this.label(key);
        if (meta && meta.Avatar || name === "Avatar") avatar.push(name);
        let limit = meta && meta.Unique ? 1 : 3;
        const inDeck = this.oppDeck?.get(key);
        if (inDeck !== void 0) limit = inDeck;
        if (n > limit) many.push(`${name} x${n} (uids ${this.playedUids(key)})`);
        if (this.oppDeck && !this.oppDeck.has(key)) outside.push(name);
      }
      if (avatar.length > 0) warn.push(`opp avatar card: ${avatar.join(", ")}`);
      if (many.length > 0) warn.push(`opp over limit: ${many.join(", ")}`);
      if (outside.length > 0) warn.push(`opp not in their deck '${this.oppDeckName}': ${outside.join(", ")}`);
      info.push(`opp seen ${seen.size}${this.oppDeck ? ` vs deck '${this.oppDeckName}'` : ""}`);
      let created = 0, mine = 0;
      for (const n of this.opponentCreated.values()) created += n;
      for (const n of this.myCreated.values()) mine += n;
      info.push(`created opp ${created} / own ${mine}`);
      if (this.resumed) info.push("resumed");
      if (this.debugCommands.size > 0) info.push(`debug ${[...this.debugCommands].map(([k, n]) => k + (n > 1 ? ` x${n}` : "")).join(", ")}`);
      this.log(`CHECK: ${warn.length === 0 ? "OK" : `WARN ${warn.join(" | ")}`} || ${info.join(" | ")}`);
    }
    playedUids(key) {
      const uids = [];
      for (const [player, uid] of this.plays) {
        const cardId = this.cardIds.get(uid);
        if (player === this.opponentUid && cardId !== void 0 && this.keyOf(cardId) === key && !uids.includes(String(uid))) uids.push(String(uid));
      }
      return uids.join(",");
    }
  };
  function sortRows(rows) {
    rows.sort((a, b) => a.Cost - b.Cost || ordinal(a.Name, b.Name));
  }
  function addStats(before, add) {
    if (!before) return add;
    let attack = 0, health = 0, any = false;
    const rest = [];
    for (const label of [before, add])
      for (const raw of label.split(",")) {
        const part = raw.trim();
        const m = /^([+-]\d+)\/([+-]\d+)$/.exec(part);
        if (m) {
          attack += Number(m[1]);
          health += Number(m[2]);
          any = true;
        } else if (part.length > 0 && !rest.includes(part)) rest.push(part);
      }
    if (any && (attack !== 0 || health !== 0)) rest.push(`${attack >= 0 ? "+" : ""}${attack}/${health >= 0 ? "+" : ""}${health}`);
    return rest.join(", ");
  }
  function modCore(label) {
    if (!label) return "";
    return label.split(",").map((p2) => p2.trim()).filter((p2) => p2.startsWith("cost ") || p2.startsWith("+") || p2.startsWith("-")).join(", ");
  }
  function botLookup(bots, aiId, scenario) {
    if (!bots) return null;
    let key = "";
    if (bots.byAiId && String(aiId) in bots.byAiId) key = bots.byAiId[String(aiId)];
    else if (bots.byScenario && scenario.length > 0 && scenario in bots.byScenario) key = bots.byScenario[scenario];
    const deck = key && bots.decks ? bots.decks[key] : void 0;
    if (!deck?.cards) return null;
    const cards = /* @__PURE__ */ new Map();
    for (const c of deck.cards) {
      const id = String(c.id ?? ""), n = Number(c.count ?? 0);
      if (id.length === 0 || n <= 0) continue;
      inc(cards, id, n);
    }
    return cards.size > 0 ? { cards, name: deck.name ?? "" } : null;
  }

  // src/core/index.ts
  var RDT_VERSION = "0.4.5";

  // src/frida/port.ts
  function port() {
    const p2 = globalThis.teslPort;
    if (p2 && typeof p2.log === "function") return p2;
    return { log: (m) => console.log(`[rdt] ${m}`) };
  }

  // src/frida/recorder.ts
  var EXTERNAL = "/sdcard/Android/data/com.bethsoft.theelderscrollslegends/files";
  function startRecorder(p2, onQueue) {
    const image = p2.img ?? Il2Cpp.domain.assembly("Assembly-CSharp").image;
    const klass = (name) => p2.cls ? p2.cls(image, name) : image.class(name);
    const translator = klass("SPTESL.LogMessageTranslator");
    const add = translator.methods.find((m) => m.name === "AddHistoryQueue" && m.parameterCount === 1 && !m.isStatic);
    if (!add || add.virtualAddress.isNull()) {
      p2.log("record: AddHistoryQueue not found; recording off");
      return;
    }
    const byteClass = Il2Cpp.corlib.class("System.Byte");
    const protobuf = Il2Cpp.domain.tryAssembly?.("Google.Protobuf")?.image;
    const outputClass = protobuf ? protobuf.class("Google.Protobuf.CodedOutputStream") : p2.ucls("Google.Protobuf.CodedOutputStream");
    const network = klass("SPTESL.GameNetworkManager");
    const settingsManager = klass("SettingsManager");
    const services = klass("SparkleServices.ServicesManager");
    const dir = `${externalDir(p2)}/rdt/replays`;
    mkdirs(dir);
    const deckInfoCache = /* @__PURE__ */ new Map();
    let source = "", out = null, header = "", failed = false, liveFailed = false, lastStamp = "", sameStamp = 0;
    function serialize(queue) {
      const size = Number(queue.method("CalculateSize").invoke());
      const array = Il2Cpp.array(byteClass, size);
      const stream = outputClass.alloc();
      stream.method(".ctor").overload("System.Byte[]").invoke(array);
      queue.method("WriteTo").invoke(stream);
      stream.method("Flush").invoke();
      return size === 0 ? new ArrayBuffer(0) : array.elements.handle.readByteArray(size);
    }
    function write(type, data) {
      const chunk = encodeChunk(type, data);
      out.write(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
      out.flush();
    }
    function writeHeader() {
      const deck = matchDeckId();
      let info = deck !== "0" ? deckInfoCache.get(deck) : { name: "", code: "" };
      if (!info) {
        info = deckInfo(deck);
        if (info.code) deckInfoCache.set(deck, info);
      }
      const h = { local: localPlayerUid(), deck, code: info.code, name: info.name, ...matchSetup() };
      const key = JSON.stringify(h);
      if (key === header) return;
      header = key;
      write(ChunkHeader, encodeHeader(h));
    }
    function manager() {
      return network.method("get_Instance").invoke();
    }
    function isSpectating() {
      try {
        const m = manager();
        return !isNull(m) && m.field("_isSpectating").value === true;
      } catch (_) {
        return false;
      }
    }
    function localPlayerUid() {
      try {
        const m = manager();
        return isNull(m) ? "0" : String(m.field("_localPlayerUid").value.field("Id").value);
      } catch (_) {
        return "0";
      }
    }
    function matchDeckId() {
      try {
        const s = settingsManager.method("get_Instance").invoke();
        const retry = isNull(s) ? null : s.field("LastRetryMatchRequestData").value;
        return isNull(retry) ? "0" : String(retry.field("DeckId").value);
      } catch (_) {
        return "0";
      }
    }
    function matchSetup() {
      const out2 = { ai: "", scenario: "" };
      try {
        const s = settingsManager.method("get_Instance").invoke();
        const retry = isNull(s) ? null : s.field("LastRetryMatchRequestData").value;
        if (isNull(retry)) return out2;
        try {
          const v = retry.field("AiDifficulty").value;
          if (v == null) throw Error("no difficulty");
          const n = typeof v === "number" ? v : Number(v?.field?.("value__")?.value ?? v);
          out2.ai = ["None", "Novice", "Adept", "Expert"][n] ?? String(n);
        } catch (_) {
        }
        try {
          const campaign = retry.field("CampaignData").value;
          if (!isNull(campaign)) out2.scenario = String(campaign.field("scenarioName").value?.content ?? "");
        } catch (_) {
        }
      } catch (_) {
      }
      return out2;
    }
    function deckInfo(id) {
      const info = { name: "", code: "" };
      try {
        const inventory = services.method("get_Instance").invoke().field("Inventory").value;
        const decks = inventory.method("get_InventoryDescription").invoke().field("decks").value;
        const count = Number(decks.method("get_Count").invoke());
        for (let i = 0; i < count; i++) {
          const deck = decks.method("get_Item").invoke(i);
          if (String(deck.field("id").value) !== id) continue;
          let name = null;
          try {
            name = deck.method("get_DisplayName").invoke();
          } catch (_) {
          }
          info.name = String(name?.content ?? deck.field("displayName").value?.content ?? "");
          try {
            info.code = codeOfDeck(inventory, deck);
          } catch (_) {
          }
          break;
        }
      } catch (_) {
      }
      return info;
    }
    function codeOfDeck(inventory, deck) {
      if (isNull(inventory.field("_inventoryDescription").value)) return "";
      const types = inventory.method("get_CardTypeLookup").invoke();
      if (isNull(types) || Number(types.method("get_Count").invoke()) === 0) return "";
      const cached = inventory.field("_hashToCodeCached").value;
      if (!isNull(cached) && Number(cached.method("get_Count").invoke()) === 0) {
        inventory.field("_hashToCodeCached").value = null;
        inventory.field("_codeToHashCached").value = null;
      }
      const codes = inventory.method("get_HashToCodeLookup").invoke();
      const counts = deckCounts(inventory, deck);
      return deckCode(counts, (h) => codes.method("ContainsKey").invoke(h) ? String(codes.method("get_Item").invoke(h).content) : void 0);
    }
    function deckCounts(inventory, deck) {
      const types = inventory.method("get_CardTypeLookup").invoke();
      const cards = deck.field("cards").value;
      const counts = /* @__PURE__ */ new Map();
      const n = Number(cards.method("get_Count").invoke());
      for (let i = 0; i < n; i++) {
        const card = cards.method("get_Item").invoke(i);
        const hash = Number(card.field("typeHash").value);
        const copies = Number(card.field("numRegular").value) + Number(card.field("numPremium").value);
        if (copies <= 0) continue;
        let base = hash;
        if (!isNull(types) && types.method("ContainsKey").invoke(hash)) {
          const alt = Number(types.method("get_Item").invoke(hash).field("AlternateOfCardTypeHash").value);
          if (alt) base = alt;
        }
        counts.set(base, (counts.get(base) ?? 0) + copies);
      }
      return counts;
    }
    function matchDeck() {
      const id = matchDeckId();
      if (id === "0") return null;
      try {
        const inventory = services.method("get_Instance").invoke().field("Inventory").value;
        const decks = inventory.method("get_InventoryDescription").invoke().field("decks").value;
        const count = Number(decks.method("get_Count").invoke());
        for (let i = 0; i < count; i++) {
          const deck = decks.method("get_Item").invoke(i);
          if (String(deck.field("id").value) !== id) continue;
          const cards = /* @__PURE__ */ new Map();
          for (const [hash, n] of deckCounts(inventory, deck)) cards.set(String(hash), n);
          return { id, name: deckInfo(id).name, cards };
        }
      } catch (_) {
      }
      return null;
    }
    function pastHistoryHandle(queue) {
      try {
        const items = queue.method("get_Queue").invoke();
        const n = Number(items.method("get_Count").invoke());
        for (let i = 0; i < n; i++) {
          const state = items.method("get_Item").invoke(i).method("get_FullGameState").invoke();
          if (isNull(state)) continue;
          const past = state.method("get_HistoryQueue").invoke();
          if (!isNull(past)) return past.handle.toString();
        }
      } catch (_) {
      }
      return "";
    }
    function record(self, queue) {
      if (failed || isSpectating()) return null;
      const key = self.handle.toString();
      if (key !== source) {
        close();
        source = key;
        const now = stamp();
        sameStamp = now === lastStamp ? sameStamp + 1 : 0;
        lastStamp = now;
        const path = `${dir}/${now}${sameStamp ? `-${sameStamp}` : ""}.rdtrec`;
        out = new File(path, "wb");
        header = "";
        p2.log(`record: ${path.slice(path.lastIndexOf("/") + 1)}`);
      }
      writeHeader();
      const bytes = new Uint8Array(serialize(queue));
      write(ChunkQueue, bytes);
      return bytes;
    }
    function close() {
      if (out) {
        try {
          out.close();
        } catch (_) {
        }
        out = null;
      }
    }
    const attach = p2.hookAttach ?? ((target, callbacks) => Interceptor.attach(target, callbacks));
    attach(add.virtualAddress, {
      onEnter(args) {
        const self = new Il2Cpp.Object(args[0]), queue = new Il2Cpp.Object(args[1]);
        let bytes = null;
        try {
          bytes = record(self, queue);
        } catch (error) {
          failed = true;
          close();
          p2.log(`record failed, off until restart: ${error}`);
        }
        if (!onQueue || liveFailed) return;
        try {
          if (isSpectating()) return;
          if (!bytes) bytes = new Uint8Array(serialize(queue));
          onQueue({
            translator: self.handle.toString(),
            bytes,
            handle: queue.handle.toString(),
            pastHandle: () => pastHistoryHandle(queue),
            local: Number(localPlayerUid()),
            deck: matchDeck
          });
        } catch (error) {
          liveFailed = true;
          p2.log(`tracking failed, off until restart: ${error?.stack ?? error}`);
        }
      }
    });
    p2.log(`record: on, ${dir}`);
  }
  function isNull(o) {
    return o == null || o.handle && o.handle.isNull();
  }
  function stamp() {
    const d = /* @__PURE__ */ new Date(), two = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
  }
  function externalDir(p2) {
    try {
      const path = p2.ucls("UnityEngine.Application").method("get_persistentDataPath").invoke();
      if (path?.content) return String(path.content);
    } catch (_) {
    }
    return EXTERNAL;
  }
  function mkdirs(path) {
    const mkdir = new NativeFunction(Process.getModuleByName("libc.so").getExportByName("mkdir"), "int", ["pointer", "int"]);
    let at = "";
    for (const part of path.split("/").filter(Boolean)) {
      at += `/${part}`;
      mkdir(Memory.allocUtf8String(at), 509);
    }
  }

  // src/frida/cardsource.ts
  var ATTR = { ManaCost: 22, Attack: 24, MaxHealth: 25 };
  var KEYWORDS = [["Charge", 28], ["Taunt", 29], ["Cover", 30], ["Deathtouch", 31], ["Breakthrough", 46], ["Ward", 47], ["Regenerate", 48], ["Drain", 70]];
  var COLORS = ["Strength", "Intelligence", "Willpower", "Agility", "Endurance"];
  var TRACKED = ["Creature", "Avatar", "Item", "Spell", "Shout", "Support", "HasAction", "HasAbility", "Prophecy", "Unknown"];
  var isNull2 = (o) => o == null || o.handle && o.handle.isNull();
  var num = (v) => typeof v === "number" ? v : Number(v?.field?.("value__")?.value ?? v);
  function prop(o, name) {
    try {
      return o.field(name).value;
    } catch (_) {
    }
    return o.method(`get_${name}`).invoke();
  }
  var str = (v) => v == null ? "" : typeof v === "string" ? v : String(v.content ?? "");
  function gameCardSource(p2, log) {
    const image = p2.img ?? Il2Cpp.domain.assembly("Assembly-CSharp").image;
    const klass = (name) => p2.cls ? p2.cls(image, name) : image.class(name);
    const services = klass("SparkleServices.ServicesManager");
    const gameManager = klass("SPTESL.GameManager");
    let textUtils = null;
    try {
      textUtils = klass("SPTESL.DynamicTextUtilities");
    } catch (_) {
      log("cards: no DynamicTextUtilities, raw descriptions");
    }
    const attrClass = klass("SPTESL.AttributeType");
    const nested = (outer, ...path) => {
      let k = klass(outer);
      for (const name of path) k = k.nestedClasses.find((n) => n.name === name);
      return k;
    };
    const subtypeNames = enumNames(() => klass("SPTESL.CardSubtype"), CARD_SUBTYPES);
    const colorNames = enumNames(() => nested("Inventory", "CardType", "ColorSubType"), ["None", "Strength", "Intelligence", "Willpower", "Agility", "Endurance", "Neutral"]);
    const describe = textUtils?.methods.find((m) => m.name === "GetFixedUpCardDescription" && m.parameterCount === 1 && m.parameters[0].type.name === "SPTESL.Card");
    const cache = /* @__PURE__ */ new Map();
    let codeTable = null;
    let failures = 0;
    function inventory() {
      return services.method("get_Instance").invoke().field("Inventory").value;
    }
    function attr(n) {
      const box = attrClass.alloc();
      box.field("value__").value = n;
      return box.unbox();
    }
    function listOf(list) {
      if (isNull2(list)) return [];
      const n = Number(list.method("get_Count").invoke()), out = [];
      for (let i = 0; i < n; i++) out.push(list.method("get_Item").invoke(i));
      return out;
    }
    function build(id) {
      const hash = Number(id);
      if (!Number.isInteger(hash)) return null;
      const rec = { id, baseId: id, inInventory: false, label: "" };
      const inv = inventory();
      const types = inv.method("get_CardTypeLookup").invoke();
      if (!isNull2(types) && types.method("ContainsKey").invoke(hash)) {
        const type = types.method("get_Item").invoke(hash);
        const alt = Number(prop(type, "AlternateOfCardTypeHash"));
        const base = alt && types.method("ContainsKey").invoke(alt) ? types.method("get_Item").invoke(alt) : type;
        rec.inInventory = true;
        rec.baseId = String(alt || hash);
        const data = prop(base, "ClientCardData");
        rec.name = str(prop(data, "Name")) || str(prop(base, "TypeName"));
        rec.color = listOf(prop(base, "ColorSubTypes")).map((v) => colorNames.get(num(v)) ?? "").filter((c) => c && c !== "Neutral" && c !== "None").join("/");
        rec.cost = Number(prop(data, "ManaCost"));
        const tracked = listOf(prop(data, "TrackedSubTypes")).map((v) => TRACKED[num(v)] ?? "");
        rec.category = tracked.includes("Creature") ? 0 : tracked.includes("Item") ? 3 : tracked.includes("Support") ? 2 : 1;
        rec.unique = prop(data, "Unique") === true;
        rec.prophecy = tracked.includes("Prophecy");
        rec.avatar = tracked.includes("Avatar");
      }
      const card = gameManager.method("get_Instance").invoke().method("GetCard").overload("System.Int32").invoke(hash);
      if (!isNull2(card)) {
        rec.infoName = str(card.field("Name").value);
        const type = [], races = [], colors = [];
        let creature = false;
        for (const v of listOf(card.field("Subtypes").value)) {
          const name = subtypeNames.get(num(v)) ?? "";
          if (COLORS.includes(name)) colors.push(name);
          if (name === "Avatar") rec.infoAvatar = true;
          if (name === "Creature") creature = true;
          if (["Creature", "Item", "Support", "Avatar"].includes(name)) type.push(name);
          else if (name === "Spell" || name === "Shout") {
            if (type.length === 0) type.push("Action");
          } else if (name.length > 0 && !["Double", "HasAction", "HasAbility", "Neutral", ...COLORS].includes(name)) races.push(name.replace(/_/g, " "));
        }
        rec.type = type.join(", ") + (races.length > 0 ? ` - ${races.join(" ")}` : "");
        rec.colors = colors.join("/");
        const intAttr = (n) => {
          try {
            return Number(card.method("GetIntegerAttribute").invoke(attr(n)));
          } catch (_) {
            return -1;
          }
        };
        rec.infoCost = rec.baseManaCost = intAttr(ATTR.ManaCost);
        rec.baseAttack = intAttr(ATTR.Attack);
        rec.baseMaxHealth = intAttr(ATTR.MaxHealth);
        rec.attack = creature || rec.baseAttack > 0 ? rec.baseAttack : -1;
        rec.health = creature || rec.baseAttack > 0 ? rec.baseMaxHealth : -1;
        let raw = "";
        try {
          raw = describe ? str(describe.invoke(card)) : str(card.field("Description").value);
        } catch (_) {
          raw = str(card.field("Description").value);
        }
        rec.text = cleanCardText(raw);
        rec.baseFlags = [];
        for (const [name, n] of KEYWORDS) {
          let on = false;
          try {
            on = card.method("GetBoolAttribute").invoke(attr(n)) === true;
          } catch (_) {
          }
          if (on || intAttr(n) > 0) rec.baseFlags.push(name);
        }
      }
      if (!rec.inInventory && isNull2(card)) return null;
      rec.label = (rec.inInventory ? rec.name : "") || rec.infoName || id;
      return rec;
    }
    return {
      get(id) {
        if (cache.has(id)) return cache.get(id) ?? void 0;
        let rec = null;
        try {
          rec = build(id);
        } catch (e) {
          if (failures++ < 5) log(`cards: ${id} unreadable: ${e}`);
        }
        cache.set(id, rec);
        return rec ?? void 0;
      },
      idOfCode(code) {
        try {
          const inv = inventory();
          if (isNull2(inv.field("_inventoryDescription").value)) return void 0;
          if (isNull2(codeTable)) codeTable = inv.method("get_CodeToHashLookup").invoke();
          if (isNull2(codeTable) || !codeTable.method("ContainsKey").invoke(Il2Cpp.string(code))) return void 0;
          return String(codeTable.method("get_Item").invoke(Il2Cpp.string(code)));
        } catch (_) {
          return void 0;
        }
      }
    };
  }
  function enumNames(find, fallback) {
    const names = /* @__PURE__ */ new Map();
    try {
      for (const f of find().fields) if (f.isLiteral) names.set(num(f.value), f.name);
    } catch (_) {
    }
    if (names.size === 0) fallback.forEach((n, i) => names.set(i, n));
    return names;
  }
  var CARD_SUBTYPES = "Creature Avatar Item Spell Shout Support Double HasAction HasAbility Strength Intelligence Willpower Agility Endurance Neutral Abomination Animated_Item Argonian Ash_Creature Atronach Automaton Ayelid Baliwog Beast Breton Centaur Chaurus Daedra Dark_Elf Defense Dragon Dreugh Dwemer Egg Elytra Fabricant Factotum Falmer Fish Fyr Gargoyle Giant Gnarl Goblin God Grummite Harpy High_Elf Insect Imp Imperial Khajiit Kwama Lurcher Mammoth Mantikora Minotaur Mudcrab Mummy Nereid Netch Nord Ogre Orc Pastry Portal Reachman Redguard Reptile Scalon Skeever Skeleton Spider Spirit Spriggan Trap Troll".split(" ");
  function cleanCardText(text) {
    if (text.length === 0) return text;
    let out = "", i = 0;
    while (i < text.length) {
      if (text[i] === "<") {
        const end = text.indexOf(">", i);
        if (end > i) {
          const tag = text.slice(i + 1, end).toLowerCase().replace(/^\/+/, "");
          if (tag === "b" || tag === "i" || tag.startsWith("color")) out += text.slice(i, end + 1);
          i = end + 1;
          continue;
        }
      }
      out += text[i++];
    }
    return out.split("\\n").join("\n").trim();
  }

  // src/frida/live.ts
  var TypeFullGameState2 = 11;
  function startLive(p2, logDir, source, makeDirs, bots) {
    const cards = new Cards(source ?? gameCardSource(p2, (m) => p2.log(m)));
    let log = null, logTries = 0;
    const write = (line) => {
      if (line.startsWith("CHECK:")) p2.log(line);
      if (!log && logTries < 3) {
        logTries++;
        try {
          makeDirs?.(logDir);
          log = new File(`${logDir}/Match.log`, "a");
        } catch (e) {
          p2.log(`tracking: no Match.log (${e})`);
        }
      }
      if (!log) return;
      try {
        log.write(`${stamp2()} ${line}
`);
        log.flush();
      } catch (_) {
      }
    };
    let stream = "", tracker = null, pending = [], pastHandle = "";
    function newMatch(e) {
      stream = e.translator;
      tracker = new Tracker({ cards, log: write, bots: bots?.() }, e.local);
      pending = [];
      pastHandle = "";
      write("Events: new match stream");
    }
    function loadDeck(e) {
      const deck = e.deck();
      if (!deck || deck.cards.size === 0) return false;
      let total = 0;
      for (const n of deck.cards.values()) total += n;
      tracker.loadDeck(deck.cards, deck.name);
      try {
        live.onDeckLoaded?.();
      } catch (_) {
      }
      write(`Overlay: deck '${deck.name}' (by id ${deck.id}) ${total} cards, ${deck.cards.size} distinct`);
      if (pending.length > 0) write(`Events: replaying ${pending.length} queued message(s)`);
      const queued = pending;
      pending = [];
      for (const q of queued) process(q.queue, q.handle);
      return true;
    }
    function process(queue, handle) {
      const t = tracker;
      const isPast = pastHandle !== "" && handle === pastHandle;
      if (isPast) pastHandle = "";
      t.processQueue(queue, isPast);
    }
    const onQueue = (e) => {
      if (e.translator !== stream || !tracker) newMatch(e);
      const t = tracker;
      t.setLocal(e.local);
      const queue = decodeHistoryQueue(e.bytes);
      if (queue.Queue.some((item) => item.Type === TypeFullGameState2 && item.FullGameState?.HistoryQueue)) pastHandle = e.pastHandle();
      if (!t.deckRows && !loadDeck(e)) {
        if (pending.length < 5e3) pending.push({ queue, handle: e.handle });
        return;
      }
      process(queue, e.handle);
      t.publish();
      t.refreshOpponent();
      t.logWindowSnapshot(false);
    };
    const live = { onQueue, current: () => tracker && tracker.deckRows ? tracker : null };
    return live;
  }
  function stamp2() {
    const d = /* @__PURE__ */ new Date(), two = (n) => String(n).padStart(2, "0");
    return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
  }

  // src/frida/deckwindow.ts
  var FakeUidBase = 9e5;
  var PickerCustomUI = 3;
  var isNull3 = (o) => o == null || o.handle && o.handle.isNull();
  function startDeckWindow(p2, current) {
    if (!p2.ui || !p2.frameGate) throw Error("the port has no ui helpers");
    const ui = p2.ui;
    const image = p2.img ?? Il2Cpp.domain.assembly("Assembly-CSharp").image;
    const klass = (name) => p2.cls ? p2.cls(image, name) : image.class(name);
    const conductorClass = klass("SPTESL.BoardConductor");
    const clientCard = klass("SPTESL.ClientCard");
    const netUidClass = klass("SPTESL.CardNetUid");
    const gameManager = klass("SPTESL.GameManager");
    const pickerType = klass("SPTESL.MatchUI").nestedClasses.find((n) => n.name === "CardListPickerType");
    const listClass = Il2Cpp.corlib.class("System.Collections.Generic.List`1").inflate(clientCard);
    let errors = 0, builtFor = "";
    let board = null, matchUi = null, openSide = null;
    const fail = (what, e) => {
      if (errors++ < 5) p2.log(`window: ${what} failed: ${e}`);
    };
    function boxed(k, field, value) {
      const box = k.alloc();
      box.field(field).value = value;
      return box.unbox();
    }
    const labels = /* @__PURE__ */ new Map();
    function cardList(cards) {
      labels.clear();
      const list = listClass.alloc();
      list.method(".ctor", 0).invoke();
      const gm = gameManager.method("get_Instance").invoke();
      const getCard = gm.method("GetCard").overload("System.Int32");
      let fake = FakeUidBase;
      for (const [id, copies, label] of cards) {
        const card = getCard.invoke(Number(id));
        if (isNull3(card)) continue;
        for (let i = 0; i < copies; i++) {
          const cc = clientCard.alloc();
          cc.method(".ctor").overload("SPTESL.Card").invoke(card);
          cc.method("set_NetUid").invoke(boxed(netUidClass, "Id", ++fake));
          labels.set(fake, label);
          list.method("Add").invoke(cc);
        }
      }
      return list;
    }
    function open(side) {
      const t = current();
      if (!t) {
        p2.log("window: no tracked deck yet");
        return;
      }
      if (isNull3(board) || isNull3(matchUi)) {
        p2.log("window: no board");
        return;
      }
      const active = matchUi.method("GetCardListPickerActive").invoke() === true;
      if (active) {
        matchUi.method("HideAndCleanupCardListPicker").invoke();
        if (openSide === side) {
          openSide = null;
          return;
        }
      }
      board.method("ToggleGenericCardPicker").invoke(cardList(t.windowCards(side)), boxed(pickerType, "value__", PickerCustomUI));
      openSide = side;
    }
    function button(name, parent, text, x, action) {
      const go = ui.uiNew(name, parent);
      ui.uiPlace(go, 0.5, 1, 0.5, 0.5, x, -160, 150, 64);
      const bg = ui.uiAdd(go, "UnityEngine.UI.Image");
      bg.method("set_color").invoke(color(0.08, 0.07, 0.06, 0.85));
      const label = ui.uiNew("Label", go.method("get_transform").invoke());
      ui.uiStretch(ui.uiRect(label));
      const tmp = ui.uiText(label, text, 30);
      tmp.method("set_color").invoke(color(1, 0.82, 0.35, 1));
      ui.uiButton(go, bg, () => {
        try {
          action();
        } catch (e) {
          fail("open", e);
        }
      });
    }
    function color(r, g, b, a) {
      const c = p2.ucls("UnityEngine.Color").alloc();
      c.field("r").value = r;
      c.field("g").value = g;
      c.field("b").value = b;
      c.field("a").value = a;
      return c.unbox();
    }
    function build() {
      const boards = Il2Cpp.gc.choose(conductorClass);
      if (boards.length === 0) {
        p2.log("window: no board yet");
        return;
      }
      board = boards[boards.length - 1];
      const key = board.handle.toString();
      if (key === builtFor) return;
      matchUi = board.field("MatchUI_Mobile").value;
      if (isNull3(matchUi)) matchUi = board.field("MatchUI_PC").value;
      if (isNull3(matchUi)) {
        p2.log("window: no match UI");
        return;
      }
      const parent = matchUi.method("get_transform").invoke();
      openSide = null;
      button("RdtDeckButton", parent, "Deck", 330, () => open("deck"));
      button("RdtOppButton", parent, "Opp", 490, () => open("opp"));
      for (const name of ["RdtDeckButton", "RdtOppButton"]) {
        const t = parent.method("Find", 1).invoke(Il2Cpp.string(name));
        if (!isNull3(t)) t.method("SetAsLastSibling").invoke();
      }
      builtFor = key;
      p2.log("window: buttons added");
    }
    const item = klass("SPTESL.CardListItem");
    const setData = item.methods.find((m) => m.name === "SetData" && m.parameterCount === 1);
    if (setData && !setData.virtualAddress.isNull()) {
      const attach = p2.hookAttach ?? ((target, callbacks) => Interceptor.attach(target, callbacks));
      attach(setData.virtualAddress, {
        onEnter(args) {
          this.item = args[0];
        },
        onLeave() {
          if (labels.size === 0) return;
          try {
            const row = new Il2Cpp.Object(this.item);
            const cc = row.field("Data").value.field("ClientCard").value;
            if (isNull3(cc)) return;
            const label = labels.get(Number(cc.method("get_NetUid").invoke().field("Id").value));
            if (label === void 0 || label === "") return;
            const count = row.field("_count").value;
            if (!isNull3(count)) count.method("set_text").invoke(Il2Cpp.string(label));
            const box = row.field("_countContainer").value;
            if (!isNull3(box)) box.method("SetActive").invoke(true);
          } catch (e) {
            fail("count", e);
          }
        }
      });
    }
    p2.log("window: on");
    return {
      onMatch() {
        p2.frameGate("rdt window", () => {
          try {
            build();
          } catch (e) {
            fail("buttons", e);
          }
        });
      }
    };
  }

  // src/frida/bots.ts
  var URLS = ["https://tesl-decks.com/tracker/bots-v1.json", "https://dev.tesl-decks.com/tracker/bots-v1.json"];
  function startBots(p2) {
    const file = p2.dataDir ? `${p2.dataDir}/bots-v1.json` : "";
    let bots;
    const use = (text, from) => {
      const data = JSON.parse(text);
      if (!data || typeof data.decks !== "object") throw Error("no decks");
      bots = data;
      p2.log(`bots: ${Object.keys(data.decks).length} bot decks (${from})`);
    };
    try {
      if (file) use(File.readAllText(file), "saved copy");
    } catch (_) {
    }
    if (p2.httpGetBytes) {
      const fetch = (i) => {
        if (i >= URLS.length) return;
        p2.httpGetBytes(URLS[i]).then((bytes) => {
          const text = utf8Decode(bytes);
          use(text, URLS[i].replace("https://", "").split("/")[0]);
          if (file) try {
            const f = new File(file, "wb");
            f.write(text);
            f.flush();
            f.close();
          } catch (e) {
            p2.log(`bots: not saved (${e})`);
          }
        }).catch(() => fetch(i + 1));
      };
      fetch(0);
    }
    return () => bots;
  }

  // src/frida/main.ts
  var p = port();
  try {
    p.log(`rdt ${RDT_VERSION} (port ${p.version ?? "?"}, il2cpp ${typeof globalThis.Il2Cpp !== "undefined" ? "ok" : "missing"})`);
    if (typeof globalThis.Il2Cpp !== "undefined") {
      let live;
      try {
        let bots;
        try {
          bots = startBots(p);
        } catch (e) {
          p.log(`bots: off (${e})`);
        }
        live = startLive(p, `${externalDir(p)}/rdt`, void 0, mkdirs, bots);
        p.log("tracking: on");
      } catch (e) {
        p.log(`tracking: off (${e})`);
      }
      if (live) {
        const current = live.current;
        try {
          const w = startDeckWindow(p, current);
          live.onDeckLoaded = w.onMatch;
        } catch (e) {
          p.log(`window: off (${e})`);
        }
      }
      startRecorder(p, live?.onQueue);
    }
  } catch (e) {
    try {
      p.log(`rdt start failed: ${e}`);
    } catch (_) {
    }
  }
})();
