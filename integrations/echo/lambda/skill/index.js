import { handleSkillRequest } from './lib.js';

export const handler = async (event) => {
  const result = handleSkillRequest(event);
  return result;
};
