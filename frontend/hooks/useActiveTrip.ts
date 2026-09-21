'use client'
import { useEffect,useState } from 'react'
const KEY='tabitrace-live-trip-id'
export function useActiveTripId(){const[id,setId]=useState<number|null>(null);useEffect(()=>{const raw=localStorage.getItem(KEY);setId(raw?Number(raw):null)},[]);return {activeTripId:id,setActiveTripId:(value:number)=>{localStorage.setItem(KEY,String(value));setId(value)}}}
