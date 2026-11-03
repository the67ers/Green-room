export function winPoints(winner,loser){return Math.min(loser,Math.max(1,Math.min(100,Math.round(20*2**Math.max(-20,Math.min(20,(loser-winner)/100))))));}
export function eloDelta(a,b,result){
 if(result===1)return winPoints(a,b);
 if(result===-1)return -winPoints(b,a);
 const difference=b-a,points=Math.min(50,Math.round(10*(2**Math.min(20,Math.abs(difference)/100)-1)));
 return difference>0?Math.min(points,b):difference<0?-Math.min(points,a):0;
}
