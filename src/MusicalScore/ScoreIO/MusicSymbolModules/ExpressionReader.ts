﻿import {MusicSheet} from "../../MusicSheet";
import {Fraction} from "../../../Common/DataObjects/Fraction";
import {MultiTempoExpression} from "../../VoiceData/Expressions/MultiTempoExpression";
import {ContDynamicEnum, ContinuousDynamicExpression} from "../../VoiceData/Expressions/ContinuousExpressions/ContinuousDynamicExpression";
import {ContinuousTempoExpression} from "../../VoiceData/Expressions/ContinuousExpressions/ContinuousTempoExpression";
import {DynamicEnum, InstantaniousDynamicExpression} from "../../VoiceData/Expressions/InstantaniousDynamicExpression";
import {OctaveShift} from "../../VoiceData/Expressions/ContinuousExpressions/OctaveShift";
import {Instrument} from "../../Instrument";
import {MultiExpression} from "../../VoiceData/Expressions/MultiExpression";
import {IXmlAttribute, IXmlElement} from "../../../Common/FileIO/Xml";
import {SourceMeasure} from "../../VoiceData/SourceMeasure";
import {InstantaniousTempoExpression} from "../../VoiceData/Expressions/InstantaniousTempoExpression";
import {MoodExpression} from "../../VoiceData/Expressions/MoodExpression";
import {UnknownExpression} from "../../VoiceData/Expressions/UnknownExpression";
import {TextAlignment} from "../../../Common/Enums/TextAlignment";
import {Logging} from "../../../Common/Logging";
import {ITextTranslation} from "../../Interfaces/ITextTranslation";

export enum PlacementEnum {
    Above = 0,
    Below = 1,
    NotYetDefined = 2
}

export class ExpressionReader {
    private musicSheet: MusicSheet;
    private placement: PlacementEnum;
    private soundTempo: number;
    private soundDynamic: number;
    private offsetDivisions: number;
    private staffNumber: number;
    private globalStaffIndex: number;
    private directionTimestamp: Fraction;
    private currentMultiTempoExpression: MultiTempoExpression;
    private openContinuousDynamicExpression: ContinuousDynamicExpression;
    private openContinuousTempoExpression: ContinuousTempoExpression;
    private activeInstantaniousDynamic: InstantaniousDynamicExpression;
    private openOctaveShift: OctaveShift;
    constructor(musicSheet: MusicSheet, instrument: Instrument, staffNumber: number) {
        this.musicSheet = musicSheet;
        this.staffNumber = staffNumber;
        this.globalStaffIndex = musicSheet.getGlobalStaffIndexOfFirstStaff(instrument) + (staffNumber - 1);
        this.initialize();
    }
    public getMultiExpression: MultiExpression;
    public readExpressionParameters(xmlNode: IXmlElement, currentInstrument: Instrument, divisions: number,
                                    inSourceMeasureCurrentFraction: Fraction,
                                    inSourceMeasureFormerFraction: Fraction,
                                    currentMeasureIndex: number,
                                    ignoreDivisionsOffset: boolean): void {
        this.initialize();
        let offsetNode: IXmlElement = xmlNode.element("offset");
        if (offsetNode !== undefined && !ignoreDivisionsOffset) {
            try {
                this.offsetDivisions = parseInt(offsetNode.value, 10);
            } catch (ex) {
                let errorMsg: string = "ReaderErrorMessages/ExpressionOffsetError" + ", Invalid expression offset -> set to default.";
                Logging.debug("ExpressionReader.readExpressionParameters", errorMsg, ex);
                this.musicSheet.SheetErrors.pushMeasureError(errorMsg);
                this.offsetDivisions = 0;
            }
        }
        this.directionTimestamp = Fraction.createFromFraction(inSourceMeasureCurrentFraction);
        let offsetFraction: Fraction = new Fraction(Math.abs(this.offsetDivisions), divisions * 4);

        if (this.offsetDivisions > 0) {
            if (inSourceMeasureCurrentFraction.RealValue > 0) {
                offsetFraction = Fraction.multiply(Fraction.minus(inSourceMeasureCurrentFraction, inSourceMeasureFormerFraction), offsetFraction);
                this.directionTimestamp = Fraction.plus(offsetFraction, inSourceMeasureCurrentFraction);
            } else { this.directionTimestamp = Fraction.createFromFraction(offsetFraction); }
        } else if (this.offsetDivisions < 0) {
            if (inSourceMeasureCurrentFraction.RealValue > 0) {
                offsetFraction = Fraction.multiply(Fraction.minus(inSourceMeasureCurrentFraction, inSourceMeasureFormerFraction), offsetFraction);
                this.directionTimestamp = Fraction.minus(inSourceMeasureCurrentFraction, offsetFraction);
            } else { this.directionTimestamp = Fraction.createFromFraction(offsetFraction); }
        }

        let placeAttr: IXmlAttribute = xmlNode.attribute("placement");
        if (placeAttr !== undefined) {
            try {
                let placementString: string = placeAttr.value;
                if (placementString === "below") {
                    this.placement = PlacementEnum.Below;
                } else if (placementString === "above") {
                    this.placement = PlacementEnum.Above;
                     }
            } catch (ex) {
                let errorMsg: string = ITextTranslation.translateText(  "ReaderErrorMessages/ExpressionPlacementError",
                                                                        "Invalid expression placement -> set to default.");
                Logging.debug("ExpressionReader.readExpressionParameters", errorMsg, ex);
                this.musicSheet.SheetErrors.pushMeasureError(errorMsg);
                this.placement = PlacementEnum.Below;
            }

        }
        if (this.placement === PlacementEnum.NotYetDefined) {
            try {
                let directionTypeNode: IXmlElement = xmlNode.element("direction-type");
                if (directionTypeNode !== undefined) {
                    let dynamicsNode: IXmlElement = directionTypeNode.element("dynamics");
                    if (dynamicsNode !== undefined) {
                        let defAttr: IXmlAttribute = dynamicsNode.attribute("default-y");
                        if (defAttr !== undefined) {
                            this.readExpressionPlacement(defAttr, "read dynamics y pos");
                        }
                    }
                    let wedgeNode: IXmlElement = directionTypeNode.element("wedge");
                    if (wedgeNode !== undefined) {
                        let defAttr: IXmlAttribute = wedgeNode.attribute("default-y");
                        if (defAttr !== undefined) {
                            this.readExpressionPlacement(defAttr, "read wedge y pos");
                        }
                    }
                    let wordsNode: IXmlElement = directionTypeNode.element("words");
                    if (wordsNode !== undefined) {
                        let defAttr: IXmlAttribute = wordsNode.attribute("default-y");
                        if (defAttr !== undefined) {
                            this.readExpressionPlacement(defAttr, "read words y pos");
                        }
                    }
                }
            } catch (ex) {
                let errorMsg: string = ITextTranslation.translateText(  "ReaderErrorMessages/ExpressionPlacementError",
                                                                        "Invalid expression placement -> set to default.");
                Logging.debug("ExpressionReader.readExpressionParameters", errorMsg, ex);
                this.musicSheet.SheetErrors.pushMeasureError(errorMsg);
                this.placement = PlacementEnum.Below;
            }

        }
        if (this.placement === PlacementEnum.NotYetDefined) {
            if (currentInstrument.Staves.length > 1) {
                this.placement = PlacementEnum.Below;
            } else if (currentInstrument.HasLyrics) {
                this.placement = PlacementEnum.Above;
                 } else { this.placement = PlacementEnum.Below; }
        }
    }
    public read(directionNode: IXmlElement, currentMeasure: SourceMeasure, inSourceMeasureCurrentFraction: Fraction): void {
        let isTempoInstruction: boolean = false;
        let isDynamicInstruction: boolean = false;
        let n: IXmlElement = directionNode.element("sound");
        if (n !== undefined) {
            let tempoAttr: IXmlAttribute = n.attribute("tempo");
            let dynAttr: IXmlAttribute = n.attribute("dynamics");
            if (tempoAttr !== undefined) {
                let match: string[] = tempoAttr.value.match(/\d+/);
                this.soundTempo = match !== undefined ? parseInt(match[0], 10) : 100;
                isTempoInstruction = true;
            }
            if (dynAttr !== undefined) {
                let match: string[] = dynAttr.value.match(/\d+/);
                this.soundDynamic = match !== undefined ? parseInt(match[0], 10) : 100;
                isDynamicInstruction = true;
            }
        }
        let dirNode: IXmlElement = directionNode.element("direction-type");
        if (dirNode === undefined) {
            return;
        }
        let dirContentNode: IXmlElement = dirNode.element("metronome");
        if (dirContentNode !== undefined) {
            let beatUnit: IXmlElement = dirContentNode.element("beat-unit");
            let hasDot: boolean = dirContentNode.element("beat-unit-dot") !== undefined;
            let bpm: IXmlElement = dirContentNode.element("per-minute");
            if (beatUnit !== undefined && bpm !== undefined) {
                let useCurrentFractionForPositioning: boolean = (dirContentNode.hasAttributes && dirContentNode.attribute("default-x") !== undefined);
                if (useCurrentFractionForPositioning) {
                    this.directionTimestamp = Fraction.createFromFraction(inSourceMeasureCurrentFraction);
                }
                let text: string = beatUnit.value + " = " + bpm.value;
                if (hasDot) {
                    text = "dotted " + text;
                }
                let bpmNumber: number = parseInt(bpm.value, 10);
                this.createNewTempoExpressionIfNeeded(currentMeasure);
                let instantaniousTempoExpression: InstantaniousTempoExpression =
                    new InstantaniousTempoExpression(   text,
                                                        this.placement,
                                                        this.staffNumber,
                                                        bpmNumber,
                                                        this.currentMultiTempoExpression,
                                                        true);
                this.currentMultiTempoExpression.addExpression(instantaniousTempoExpression, "");
                this.currentMultiTempoExpression.CombinedExpressionsText = text;
            }
            return;
        }

        dirContentNode = dirNode.element("dynamics");
        if (dirContentNode !== undefined) {
            let fromNotation: boolean = directionNode.element("notations") !== undefined;
            this.interpretInstantaniousDynamics(dirContentNode, currentMeasure, inSourceMeasureCurrentFraction, fromNotation);
            return;
        }

        dirContentNode = dirNode.element("words");
        if (dirContentNode !== undefined) {
            if (isTempoInstruction) {
                this.createNewTempoExpressionIfNeeded(currentMeasure);
                this.currentMultiTempoExpression.CombinedExpressionsText = dirContentNode.value;
                let instantaniousTempoExpression: InstantaniousTempoExpression =
                    new InstantaniousTempoExpression(dirContentNode.value, this.placement, this.staffNumber, this.soundTempo, this.currentMultiTempoExpression);
                this.currentMultiTempoExpression.addExpression(instantaniousTempoExpression, "");
            } else if (!isDynamicInstruction) {
                this.interpretWords(dirContentNode, currentMeasure, inSourceMeasureCurrentFraction);
            }
            return;
        }

        dirContentNode = dirNode.element("wedge");
        if (dirContentNode !== undefined) {
            this.interpretWedge(dirContentNode, currentMeasure, inSourceMeasureCurrentFraction, currentMeasure.MeasureNumber);
            return;
        }
    }
    public checkForOpenExpressions(sourceMeasure: SourceMeasure, timestamp: Fraction): void {
        if (this.openContinuousDynamicExpression !== undefined) {
            this.createNewMultiExpressionIfNeeded(sourceMeasure, timestamp);
            this.closeOpenContinuousDynamic();
        }
        if (this.openContinuousTempoExpression !== undefined) {
            this.closeOpenContinuousTempo(Fraction.plus(sourceMeasure.AbsoluteTimestamp, timestamp));
        }
    }
    public addOctaveShift(directionNode: IXmlElement, currentMeasure: SourceMeasure, endTimestamp: Fraction): void {
        let octaveStaffNumber: number = 1;
        let staffNode: IXmlElement = directionNode.element("staff");
        if (staffNode !== undefined) {
            try {
                octaveStaffNumber = parseInt(staffNode.value, 10);
            } catch (ex) {
                let errorMsg: string = ITextTranslation.translateText(  "ReaderErrorMessages/OctaveShiftStaffError",
                                                                        "Invalid octave shift staff number -> set to default");
                this.musicSheet.SheetErrors.pushMeasureError(errorMsg);
                octaveStaffNumber = 1;
                Logging.debug("ExpressionReader.addOctaveShift", errorMsg, ex);
            }
        }
        let directionTypeNode: IXmlElement = directionNode.element("direction-type");
        if (directionTypeNode !== undefined) {
            let octaveShiftNode: IXmlElement = directionTypeNode.element("octave-shift");
            if (octaveShiftNode !== undefined && octaveShiftNode.hasAttributes) {
                try {
                    if (octaveShiftNode.attribute("size") !== undefined) {
                        let size: number = parseInt(octaveShiftNode.attribute("size").value, 10);
                        let octave: number = 0;
                        if (size === 8) {
                            octave = 1;
                        } else if (size === 15) {
                            octave = 2;
                             }
                        if (octaveShiftNode.attribute("type") !== undefined) {
                            let type: string = octaveShiftNode.attribute("type").value;
                            if (type === "up" || type === "down") {
                                let octaveShift: OctaveShift = new OctaveShift(type, octave);
                                octaveShift.StaffNumber = octaveStaffNumber;
                                this.createNewMultiExpressionIfNeeded(currentMeasure);
                                this.getMultiExpression.OctaveShiftStart = octaveShift;
                                octaveShift.ParentStartMultiExpression = this.getMultiExpression;
                                this.openOctaveShift = octaveShift;
                            } else if (type === "stop") {
                                if (this.openOctaveShift !== undefined) {
                                    this.createNewMultiExpressionIfNeeded(currentMeasure, endTimestamp);
                                    this.getMultiExpression.OctaveShiftEnd = this.openOctaveShift;
                                    this.openOctaveShift.ParentEndMultiExpression = this.getMultiExpression;
                                    this.openOctaveShift = undefined;
                                }
                            }
                        }
                    }
                } catch (ex) {
                    let errorMsg: string = ITextTranslation.translateText("ReaderErrorMessages/OctaveShiftError", "Error while reading octave shift.");
                    this.musicSheet.SheetErrors.pushMeasureError(errorMsg);
                    Logging.debug("ExpressionReader.addOctaveShift", errorMsg, ex);
                }
            }
        }
    }
    private initialize(): void {
        this.placement = PlacementEnum.NotYetDefined;
        this.soundTempo = 0;
        this.soundDynamic = 0;
        this.offsetDivisions = 0;
    }
    private readExpressionPlacement(defAttr: IXmlAttribute, catchLogMessage: string): void {
        try {
            let y: number = parseInt(defAttr.value, 10);
            if (y < 0) {
                this.placement = PlacementEnum.Below;
            } else if (y > 0) {
                this.placement = PlacementEnum.Above;
                 }
        } catch (ex) {
            Logging.debug("ExpressionReader.readExpressionParameters", catchLogMessage, ex);
        }

    }
    private interpretInstantaniousDynamics(dynamicsNode: IXmlElement,
                                           currentMeasure: SourceMeasure,
                                           inSourceMeasureCurrentFraction: Fraction,
                                           fromNotation: boolean): void {
        if (dynamicsNode.hasElements) {
            if (dynamicsNode.hasAttributes && dynamicsNode.attribute("default-x") !== undefined) {
                this.directionTimestamp = Fraction.createFromFraction(inSourceMeasureCurrentFraction);
            }
            let name: string = dynamicsNode.elements()[0].name;
            if (name !== undefined) {
                let dynamicEnum: DynamicEnum;
                try {
                    dynamicEnum = DynamicEnum[name];
                } catch (err) {
                    let errorMsg: string = ITextTranslation.translateText("ReaderErrorMessages/DynamicError", "Error while reading dynamic.");
                    this.musicSheet.SheetErrors.pushMeasureError(errorMsg);
                    return;
                }

                if (this.activeInstantaniousDynamic === undefined ||
                    (this.activeInstantaniousDynamic !== undefined && this.activeInstantaniousDynamic.DynEnum !== dynamicEnum)) {
                    if (!fromNotation) {
                        this.createNewMultiExpressionIfNeeded(currentMeasure);
                    } else { this.createNewMultiExpressionIfNeeded(currentMeasure, Fraction.createFromFraction(inSourceMeasureCurrentFraction)); }
                    if (this.openContinuousDynamicExpression !== undefined &&
                        this.openContinuousDynamicExpression.StartMultiExpression !== this.getMultiExpression) {
                        this.closeOpenContinuousDynamic();
                    }
                    let instantaniousDynamicExpression: InstantaniousDynamicExpression = new InstantaniousDynamicExpression(name,
                                                                                                                            this.soundDynamic,
                                                                                                                            this.placement,
                                                                                                                            this.staffNumber);
                    this.getMultiExpression.addExpression(instantaniousDynamicExpression, "");
                    this.initialize();
                    if (this.activeInstantaniousDynamic !== undefined) {
                        this.activeInstantaniousDynamic.DynEnum = instantaniousDynamicExpression.DynEnum;
                    } else { this.activeInstantaniousDynamic = new InstantaniousDynamicExpression(name, 0, PlacementEnum.NotYetDefined, 1); }
                }
            }
        }
    }
    private interpretWords(wordsNode: IXmlElement, currentMeasure: SourceMeasure, inSourceMeasureCurrentFraction: Fraction): void {
        let text: string = wordsNode.value;
        if (text.length > 0) {
            if (wordsNode.hasAttributes && wordsNode.attribute("default-x") !== undefined) {
                this.directionTimestamp = Fraction.createFromFraction(inSourceMeasureCurrentFraction);
            }
            if (this.checkIfWordsNodeIsRepetitionInstruction(text)) {
                return;
            }
            this.fillMultiOrTempoExpression(text, currentMeasure);
            this.initialize();
        }
    }
    private interpretWedge(wedgeNode: IXmlElement, currentMeasure: SourceMeasure, inSourceMeasureCurrentFraction: Fraction, currentMeasureIndex: number): void {
        if (wedgeNode !== undefined && wedgeNode.hasAttributes && wedgeNode.attribute("default-x") !== undefined) {
            this.directionTimestamp = Fraction.createFromFraction(inSourceMeasureCurrentFraction);
        }
        this.createNewMultiExpressionIfNeeded(currentMeasure);
        this.addWedge(wedgeNode, currentMeasureIndex);
        this.initialize();
    }
    private createNewMultiExpressionIfNeeded(currentMeasure: SourceMeasure, timestamp: Fraction = undefined): void {
        if (timestamp === undefined) {
            timestamp = this.directionTimestamp;
        }
        if (this.getMultiExpression === undefined ||
            this.getMultiExpression !== undefined &&
            (this.getMultiExpression.SourceMeasureParent !== currentMeasure ||
                (this.getMultiExpression.SourceMeasureParent === currentMeasure && this.getMultiExpression.Timestamp !== timestamp))) {
            this.getMultiExpression = new MultiExpression(currentMeasure, Fraction.createFromFraction(timestamp));
            currentMeasure.StaffLinkedExpressions[this.globalStaffIndex].push(this.getMultiExpression);
        }
    }

    private createNewTempoExpressionIfNeeded(currentMeasure: SourceMeasure): void {
        if (this.currentMultiTempoExpression === undefined ||
            this.currentMultiTempoExpression.SourceMeasureParent !== currentMeasure ||
            this.currentMultiTempoExpression.Timestamp !== this.directionTimestamp) {
            this.currentMultiTempoExpression = new MultiTempoExpression(currentMeasure, Fraction.createFromFraction(this.directionTimestamp));
            currentMeasure.TempoExpressions.push(this.currentMultiTempoExpression);
        }
    }
    private addWedge(wedgeNode: IXmlElement, currentMeasureIndex: number): void {
        if (wedgeNode !== undefined && wedgeNode.hasAttributes) {
            let type: string = wedgeNode.attribute("type").value.toLowerCase();
            try {
                if (type === "crescendo" || type === "diminuendo") {
                    let continuousDynamicExpression: ContinuousDynamicExpression = new ContinuousDynamicExpression( ContDynamicEnum[type],
                                                                                                                    this.placement, this.staffNumber);
                    if (this.openContinuousDynamicExpression !== undefined) {
                        this.closeOpenContinuousDynamic();
                    }
                    this.openContinuousDynamicExpression = continuousDynamicExpression;
                    this.getMultiExpression.StartingContinuousDynamic = continuousDynamicExpression;
                    continuousDynamicExpression.StartMultiExpression = this.getMultiExpression;
                    if (this.activeInstantaniousDynamic !== undefined &&
                        this.activeInstantaniousDynamic.StaffNumber === continuousDynamicExpression.StaffNumber) {
                        this.activeInstantaniousDynamic = undefined;
                    }
                } else if (type === "stop") {
                    if (this.openContinuousDynamicExpression !== undefined) {
                        this.closeOpenContinuousDynamic();
                    }
                }
            } catch (ex) {
                let errorMsg: string = "ReaderErrorMessages/WedgeError" + ", Error while reading Crescendo / Diminuendo.";
                this.musicSheet.SheetErrors.pushMeasureError(errorMsg);
                Logging.debug("ExpressionReader.addWedge", errorMsg, ex);
            }
        }
    }
    private fillMultiOrTempoExpression(inputString: string, currentMeasure: SourceMeasure): void {
        if (inputString === undefined) {
            return;
        }
        let tmpInputString: string = inputString.trim();
        // split string at enumerating words or signs
        let splitStrings: string[] = tmpInputString.split(/([\s,\r\n]and[\s,\r\n]|[\s,\r\n]und[\s,\r\n]|[\s,\r\n]e[\s,\r\n]|[\s,\r\n])+/g);

        for (let splitStr of splitStrings) {
            this.createExpressionFromString("", splitStr, currentMeasure, inputString);
        }
    }
    /*
    private splitStringRecursive(input: [string, string], stringSeparators: string[]): [string, string][] {
        let text: string = input[1];
        let lastSeparator: string = input[0];
        let resultList: [string, string][] = [];
        for (let idx: number = 0, len: number = stringSeparators.length; idx < len; ++idx) {
            let stringSeparator: string = stringSeparators[idx];
            if (text.indexOf(stringSeparator) < 0) {
                continue;
            }
            let splitStrings: string[] = text.split(stringSeparator, StringSplitOptions.RemoveEmptyEntries);

            if (splitStrings.length !== 0) {
                resultList.push(...this.splitStringRecursive([lastSeparator, splitStrings[0]], stringSeparators));
                for (let index: number = 1; index < splitStrings.length; index++) {
                    resultList.push(...this.splitStringRecursive([stringSeparator, splitStrings[index]], stringSeparators));
                }
            } else {
                resultList.push(["", stringSeparator]);
            }
            break;
        }
        if (resultList.length === 0) {
            resultList.push(input);
        }
        return resultList;
    }
    */
    private createExpressionFromString(prefix: string, stringTrimmed: string,
                                       currentMeasure: SourceMeasure, inputString: string): boolean {
        if (InstantaniousTempoExpression.isInputStringInstantaniousTempo(stringTrimmed) ||
            ContinuousTempoExpression.isInputStringContinuousTempo(stringTrimmed)) {
            // first check if there is already a tempo expression with the same function
            if (currentMeasure.TempoExpressions.length > 0) {
                for (let idx: number = 0, len: number = currentMeasure.TempoExpressions.length; idx < len; ++idx) {
                    let multiTempoExpression: MultiTempoExpression = currentMeasure.TempoExpressions[idx];
                    if (multiTempoExpression.Timestamp === this.directionTimestamp &&
                        multiTempoExpression.InstantaniousTempo !== undefined &&
                        multiTempoExpression.InstantaniousTempo.Label.indexOf(stringTrimmed) !== -1) {
                        return false;
                    }
                }
            }
            this.createNewTempoExpressionIfNeeded(currentMeasure);
            this.currentMultiTempoExpression.CombinedExpressionsText = inputString;
            if (InstantaniousTempoExpression.isInputStringInstantaniousTempo(stringTrimmed)) {
                let instantaniousTempoExpression: InstantaniousTempoExpression = new InstantaniousTempoExpression(  stringTrimmed,
                                                                                                                    this.placement,
                                                                                                                    this.staffNumber,
                                                                                                                    this.soundTempo,
                                                                                                                    this.currentMultiTempoExpression);
                this.currentMultiTempoExpression.addExpression(instantaniousTempoExpression, prefix);
                return true;
            }
            if (ContinuousTempoExpression.isInputStringContinuousTempo(stringTrimmed)) {
                let continuousTempoExpression: ContinuousTempoExpression = new ContinuousTempoExpression(   stringTrimmed,
                                                                                                            this.placement,
                                                                                                            this.staffNumber,
                                                                                                            this.currentMultiTempoExpression);
                this.currentMultiTempoExpression.addExpression(continuousTempoExpression, prefix);
                return true;
            }
        }
        if (InstantaniousDynamicExpression.isInputStringInstantaniousDynamic(stringTrimmed) ||
            ContinuousDynamicExpression.isInputStringContinuousDynamic(stringTrimmed)) {
            this.createNewMultiExpressionIfNeeded(currentMeasure);
            if (InstantaniousDynamicExpression.isInputStringInstantaniousDynamic(stringTrimmed)) {
                if (this.openContinuousDynamicExpression !== undefined && this.openContinuousDynamicExpression.EndMultiExpression === undefined) {
                    this.closeOpenContinuousDynamic();
                }
                let instantaniousDynamicExpression: InstantaniousDynamicExpression = new InstantaniousDynamicExpression(stringTrimmed,
                                                                                                                        this.soundDynamic,
                                                                                                                        this.placement,
                                                                                                                        this.staffNumber);
                this.getMultiExpression.addExpression(instantaniousDynamicExpression, prefix);
                return true;
            }
            if (ContinuousDynamicExpression.isInputStringContinuousDynamic(stringTrimmed)) {
                let continuousDynamicExpression: ContinuousDynamicExpression = new ContinuousDynamicExpression( undefined,
                                                                                                                this.placement,
                                                                                                                this.staffNumber,
                                                                                                                stringTrimmed);
                if (this.openContinuousDynamicExpression !== undefined && this.openContinuousDynamicExpression.EndMultiExpression === undefined) {
                    this.closeOpenContinuousDynamic();
                }
                if (this.activeInstantaniousDynamic !== undefined && this.activeInstantaniousDynamic.StaffNumber === continuousDynamicExpression.StaffNumber) {
                    this.activeInstantaniousDynamic = undefined;
                }
                this.openContinuousDynamicExpression = continuousDynamicExpression;
                continuousDynamicExpression.StartMultiExpression = this.getMultiExpression;
                this.getMultiExpression.addExpression(continuousDynamicExpression, prefix);
                return true;
            }
        }
        if (MoodExpression.isInputStringMood(stringTrimmed)) {
            this.createNewMultiExpressionIfNeeded(currentMeasure);
            let moodExpression: MoodExpression = new MoodExpression(stringTrimmed, this.placement, this.staffNumber);
            this.getMultiExpression.addExpression(moodExpression, prefix);
            return true;
        }

        // create unknown:
        this.createNewMultiExpressionIfNeeded(currentMeasure);
        if (currentMeasure.TempoExpressions.length > 0) {
            for (let idx: number = 0, len: number = currentMeasure.TempoExpressions.length; idx < len; ++idx) {
                let multiTempoExpression: MultiTempoExpression = currentMeasure.TempoExpressions[idx];
                if (multiTempoExpression.Timestamp === this.directionTimestamp &&
                    multiTempoExpression.InstantaniousTempo !== undefined &&
                    multiTempoExpression.EntriesList.length > 0 &&
                    !this.hasDigit(stringTrimmed)) {
                    if (this.globalStaffIndex > 0) {
                        if (multiTempoExpression.EntriesList[0].label.indexOf(stringTrimmed) >= 0) {
                            return false;
                        } else {
                            break;
                        }
                    }
                }
            }
        }
        let unknownExpression: UnknownExpression = new UnknownExpression(stringTrimmed, this.placement, TextAlignment.CenterBottom, this.staffNumber);
        this.getMultiExpression.addExpression(unknownExpression, prefix);

        return false;
    }
    private closeOpenContinuousDynamic(): void {
        this.openContinuousDynamicExpression.EndMultiExpression = this.getMultiExpression;
        this.getMultiExpression.EndingContinuousDynamic = this.openContinuousDynamicExpression;
        this.openContinuousDynamicExpression = undefined;
    }
    private closeOpenContinuousTempo(endTimestamp: Fraction): void {
        this.openContinuousTempoExpression.AbsoluteEndTimestamp = endTimestamp;
        this.openContinuousTempoExpression = undefined;
    }
    private checkIfWordsNodeIsRepetitionInstruction(inputString: string): boolean {
        inputString = inputString.trim().toLowerCase();
        if (inputString === "coda" ||
            inputString === "tocoda" ||
            inputString === "to coda" ||
            inputString === "fine" ||
            inputString === "d.c." ||
            inputString === "dacapo" ||
            inputString === "da capo" ||
            inputString === "d.s." ||
            inputString === "dalsegno" ||
            inputString === "dal segno" ||
            inputString === "d.c. al fine" ||
            inputString === "d.s. al fine" ||
            inputString === "d.c. al coda" ||
            inputString === "d.s. al coda") {
            return true;
        }
        return false;
    }
    private hasDigit(input: string): boolean {
        return /\d/.test(input);
    }
}