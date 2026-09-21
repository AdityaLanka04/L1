import { displayName, experienceProgress } from '../../utils/displayName';
it('uses names and handles without a full email heading', () => {
  expect(displayName({first_name:'Ada',last_name:'Lovelace',username:'ada@example.com'})).toBe('Ada Lovelace');
  expect(displayName({username:'ada'})).toBe('ada');
  expect(displayName({username:'ada@example.com'})).toBe('ada');
  expect(displayName({email:'ada@example.com'})).toBe('ada');
  expect(displayName({})).toBe('Learner');
});
it('always returns a finite bounded experience percentage',()=>{ for(const input of [undefined,null,'bad',Infinity,-100]) expect(experienceProgress(input)).toBe(0); expect(experienceProgress(1500)).toBe(50); });
