import { DateKind } from '../models/DateInfo';
import { Errors } from './errors';

export function dateKindCodeToDateKind(dateKindCode: number): DateKind {
  if (dateKindCode < 1 || dateKindCode > 5) {
    throw Errors.BadRequest(`유효하지 않은 dateKindCode: ${dateKindCode}`);
  }

  const dateKindNumber = dateKindCode.toString().padStart(2, '0');

  return dateKindNumber as DateKind;
}
