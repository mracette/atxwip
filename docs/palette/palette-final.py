L={'residential':'#3A6FD0','commercial':'#C2379F','civic':'#735A12','transport':'#E35A0B','trails':'#17935C','complete':'#A6A5A0'}
D={'residential':'#5C8BF7','commercial':'#F59CCB','civic':'#F2D25A','transport':'#F07430','trails':'#2EBD78','complete':'#5F6A72'}
cats('LIGHT',L,'#F1EEE7'); cats('DARK',D,'#0E1B2E')
for k in L: print(k, 'light-on-surface', round(cr(L[k],'#FAF8F4'),2), 'dark-on-surface', round(cr(D[k],'#12223A'),2))
text('extra',[('#FFFFFF','#E35A0B','white on transport'),('#1B1F24','#F2D25A','ink on civic dark'),('#FFFFFF','#3A6FD0','white on residential'),('#FFFFFF','#735A12','white on civic L'),('#1B1F24','#A6A5A0','ink on complete L'),('#FFFFFF','#17935C','white on trails'),('#FFFFFF','#C2379F','white on commercial'),
 ('#6B7280','#FAF8F4','x'),('#FFFFFF','#1B1F24','x'),('#A9B6C9','#0E1B2E','x'),('#5A6069','#EDE9E0','ink-2 on sunken'),('#1B1F24','#E8EDF5','x')])
text('final',[('#3A566B','#C8D5DE','L water label'),('#4F545C','#E4E0D6','L label on ctx bldg'),('#4F545C','#DCE3CF','L label on park'),('#6B7280','#FAF8F4','L ink-3'),('#6B7280','#F1EEE7','L ink-3 on land'),
('#8393AB','#0E1B2E','D ink-3 on land'),('#9FB2CC','#22395A','D label on major road'),('#7F9CC0','#081424','D water label'),('#9FB2CC','#0F2A2A','D label on park'),
('#FFFFFF','#B8480C','white on accent-strong'),('#1B1F24','#F26B1D','ink on accent'),('#1B1F24','#FF7A33','D ink on accent'),('#2F5FB8','#FAF8F4','L link/focus'),('#8AB4FF','#12223A','D link/focus'),
('#1B1F24','#E7E3DA','chip planned L'),('#E8EDF5','#22324D','chip planned D'),('#1D5E3D','#DCEFE3','chip complete L'),('#9BE3BD','#123A2C','chip complete D'),('#9A3A06','#FDE6D6','chip uc L'),('#1B1F24','#F26B1D','chip uc solid')])
print(cr('#D9D4C8','#FAF8F4'), cr('#26395A','#12223A'))
