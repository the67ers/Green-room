export function winPoints(winner,loser){return Math.min(loser,Math.max(1,Math.min(100,Math.round(20*2**Math.max(-20,Math.min(20,(loser-winner)/100))))));}
export function eloDelta(a,b,result){
 if(result===1)return winPoints(a,b);
 if(result===-1)return -winPoints(b,a);
 const difference=b-a,points=Math.min(50,Math.round(10*(2**Math.min(20,Math.abs(difference)/100)-1)));
 return difference>0?Math.min(points,b):difference<0?-Math.min(points,a):0;
}
// A shared small shift makes gains and losses vary independently around the base.
export function ratedChanges(a,b,result,firstGame=false,shift=0){
 if(firstGame&&a===400&&b===400&&result!==0)return {aDelta:result*50,bDelta:-result*50};
 const base=eloDelta(a,b,result);if(result===0)return {aDelta:base,bDelta:-base};
 const adjustment=Math.max(-4,Math.min(4,Math.round(shift)));
 const gain=Math.max(1,Math.min(100,Math.abs(base)+adjustment));
 const loss=Math.max(0,Math.min(result===1?b:a,Math.max(1,Math.abs(base)-adjustment)));
 return result===1?{aDelta:gain,bDelta:-loss}:{aDelta:-loss,bDelta:gain};
}
