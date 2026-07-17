/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { mountFnGenerator } from "../util/mountFnGenerator.js";
import { AudioRecorder } from "./AudioRecorder.js";

export const mountAudioRecorder = mountFnGenerator(AudioRecorder);