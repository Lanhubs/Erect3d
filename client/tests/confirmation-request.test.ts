import {expect,test} from 'bun:test'
import {confirmationRequest} from '../src/app/confirmationRequest'
test('cancelled and replaced confirmations never execute an action or resolve twice',async()=>{
  const results:boolean[]=[],actions:number[]=[]
  const request=confirmationRequest({title:'Delete?',message:'Project',onConfirm:async()=>{actions.push(1)}},value=>results.push(value))
  request.cancel();request.cancel();expect(await request.accept()).toBe(false)
  expect(actions).toEqual([]);expect(results).toEqual([false])
})
test('pending actions cannot be submitted twice and finish once after overlay replacement',async()=>{
  const results:boolean[]=[],actions:number[]=[];let done!:()=>void
  const request=confirmationRequest({title:'Delete?',message:'Project',onConfirm:()=>{actions.push(1);return new Promise<void>(resolve=>{done=resolve})}},value=>results.push(value))
  const pending=request.accept();expect(await request.accept()).toBe(false);request.cancel()
  expect(results).toEqual([]);done();expect(await pending).toBe(true);request.cancel()
  expect(results).toEqual([true]);expect(actions).toEqual([1])
})
test('failed actions remain unconfirmed and can be retried',async()=>{
  const results:boolean[]=[];let attempt=0
  const request=confirmationRequest({title:'Delete?',message:'Project',onConfirm:async()=>{if(!attempt++)throw Error('Reconnect')}},value=>results.push(value))
  await expect(request.accept()).rejects.toThrow('Reconnect');expect(results).toEqual([])
  expect(await request.accept()).toBe(true);expect(results).toEqual([true])
})
