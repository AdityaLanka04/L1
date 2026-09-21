import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BattleNotification from '../../pages/BattleNotification';
it('renders a labelled challenge dialog and closes with Escape',()=>{
 const close=jest.fn();render(<BattleNotification battle={{id:7,challenger:{username:'ada@example.test',first_name:'Ada',last_name:'Lovelace'},subject:'Probability',difficulty:'intermediate',question_count:10,time_limit_seconds:300}} onClose={close} onAccept={()=>{}} onDecline={()=>{}} busy />);
 expect(screen.getByRole('dialog',{name:'Battle Challenge!'})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Accept Challenge'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Close battle challenge'})).toHaveFocus();
 fireEvent.keyDown(document,{key:'Escape'});expect(close).toHaveBeenCalledTimes(1);
});
