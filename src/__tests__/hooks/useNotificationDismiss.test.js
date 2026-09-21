import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import useNotificationDismiss from '../../hooks/useNotificationDismiss';
function Popup({ close }) { const events=useNotificationDismiss(close,12000); return <div {...events}><button>Read notification</button></div>; }
it('pauses auto-dismiss while focused and gives a new reading interval on blur',()=>{
  jest.useFakeTimers();const close=jest.fn();render(<Popup close={close}/>);
  fireEvent.focus(screen.getByRole('button'));
  act(()=>jest.advanceTimersByTime(30000));expect(close).not.toHaveBeenCalled();
  fireEvent.blur(screen.getByRole('button'),{relatedTarget:document.body});
  act(()=>jest.advanceTimersByTime(11999));expect(close).not.toHaveBeenCalled();
  act(()=>jest.advanceTimersByTime(1));expect(close).toHaveBeenCalledTimes(1);jest.useRealTimers();
});
