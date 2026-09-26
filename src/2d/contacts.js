// Hysteresis: dismissing a dialog cannot immediately reopen it while still touching.
export function createContactLatch(){
  const blocked=new Set();
  return {
    clear(){blocked.clear();},
    block(key){if(key)blocked.add(key);},
    update(candidates,paused=false){
      const near=new Set(candidates.filter(c=>c.near).map(c=>c.key));
      for(const key of blocked)if(!near.has(key))blocked.delete(key);
      if(paused)return null;
      const hit=candidates.find(c=>c.touching&&!blocked.has(c.key));
      if(hit)blocked.add(hit.key);
      return hit||null;
    },
  };
}
