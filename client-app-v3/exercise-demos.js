// Exact movement aliases only: never substitute equipment or exercise variants.
const rpTechniqueDemos = [
 {id:'UCXxvVItLoM',name:'Seated cable row',aliases:['seated cable row'],cues:['Sit tall with feet supported and knees slightly bent.','Pull the handle towards your lower ribs, without rocking back.','Return slowly, letting your arms reach forward.']},
 {id:'HzIiNhHhhtA',name:'Seated dumbbell shoulder press',aliases:['seated dumbbell shoulder press','seated db shoulder press','seated dumbbell shoulder press (light)'],cues:['Sit against the backrest with feet planted.','Press the dumbbells overhead without arching your back.','Lower under control through your comfortable range.']},
 {id:'EUIri47Epcg',name:'Normal-grip lat pulldown',aliases:['lat pulldown','normal grip pulldown'],cues:['Secure your thighs under the pad and keep your torso steady.','Pull your elbows down, bringing the bar towards your upper chest.','Return slowly; avoid swinging or pulling behind your head.']},
 {id:'5CECBjd7HLQ',name:'Incline dumbbell press',aliases:['incline dumbbell press','incline dumbbell bench press','incline db press'],cues:['Set the bench to a moderate incline and plant both feet.','Lower the dumbbells under control beside your chest.','Press up with wrists stacked over your forearms.']}
];
function rpDemoForExercise(exercise){
 const name=String(exercise.name||'').trim().toLowerCase().replace(/\s+/g,' ');
 return rpTechniqueDemos.find(demo=>demo.aliases.includes(name))||null;
}
function rpDemoMarkup(demo){
 // YouTube's end parameter bounds this in-app segment; original runtime is not asserted.
 const url='https://www.youtube-nocookie.com/embed/'+demo.id+'?start=0&end=45&rel=0&playsinline=1';
 return `<section class="rp-demo"><details><summary><span class="rp-play" aria-hidden="true">▶</span><span><b>Watch exercise demo</b><small>Renaissance Periodization · up to 45-second segment</small></span></summary><iframe src="${url}" title="${esc(demo.name)} — Renaissance Periodization demonstration" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><p class="muted">The app requests the first 45 seconds of the original technique video. Follow your prescribed range and coach instructions.</p></details><h4>How to do it</h4><ol>${demo.cues.map(cue=>`<li>${esc(cue)}</li>`).join('')}</ol></section>`;
}
const exerciseCardBeforeDemos=exerciseCard;
exerciseCard=function(exercise,loggable=false){
 const demo=rpDemoForExercise(exercise);
 let html=exerciseCardBeforeDemos(exercise,loggable);
 if(!demo)return html.replace('<span class="pill">NO VIDEO</span>','<span class="pill">Demo not yet added</span>');
 html=html.replace(/<a class="btn ghost small"[^>]*>Watch video<\/a>|<span class="pill">NO VIDEO<\/span>/,'<span class="pill">RP technique demo</span>');
 return html.replace('<div class="prescription-grid">',rpDemoMarkup(demo)+'<div class="prescription-grid">');
};
// The sample's shoulder press is explicitly seated to match the demonstration.
const sampleBeforeDemos=fullCoachingSample;
fullCoachingSample=function(index=0){
 const data=sampleBeforeDemos(index);
 for(const exercise of data.exercises||[])if(exercise.name==='Dumbbell shoulder press')exercise.name='Seated dumbbell shoulder press';
 return data;
};
