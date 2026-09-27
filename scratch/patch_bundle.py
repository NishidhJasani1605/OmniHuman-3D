with open('assets/index-CW6uCXww.js', 'r', encoding='utf-8') as f:
    text = f.read()

s1_old = 'if(s&&(h=Sm.damp(h,i.explode,8,r),l=!0),a||s||ge<0){'
s1_new = 'if(s&&(h=Sm.damp(h,i.explode,8,r),l=!0),(a||s||ge<0)&&!window.__ATLAS_DISSECTING__){'

s2_old = 'let u=i.isolate?i.selected.join(`,`)+`:`+i.reset+`:`+i.inspectorOpen+`:`+b.aspect:``;if(u!==p||i.isolate&&s){if(i.isolate){let n=new $m;'
s2_new = 'let u=i.isolate&&!window.__ATLAS_DISSECTING__?i.selected.join(`,`)+`:`+i.reset+`:`+i.inspectorOpen+`:`+b.aspect:``;if(u!==p||i.isolate&&s){if(i.isolate&&!window.__ATLAS_DISSECTING__){let n=new $m;'

print('s1 count:', text.count(s1_old))
print('s2 count:', text.count(s2_old))

assert text.count(s1_old) == 1, 's1_old not found'
assert text.count(s2_old) == 1, 's2_old not found'

text = text.replace(s1_old, s1_new)
text = text.replace(s2_old, s2_new)

with open('assets/index-CW6uCXww.js', 'w', encoding='utf-8') as f:
    f.write(text)

print('SUCCESS: Patched assets/index-CW6uCXww.js for __ATLAS_DISSECTING__!')
