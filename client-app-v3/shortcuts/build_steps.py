#!/usr/bin/env python3
"""Build an inspectable unsigned Apple Shortcut. No keys or Health values are baked in.
Action format grounded in iOS exports documented by the shortcuts-playground project.
Signing and a physical iPhone run remain separate release gates.
"""
import plistlib,uuid,pathlib
OUT=pathlib.Path(__file__).parent
uid=lambda:str(uuid.uuid4()).upper()
actions=[]
def action(name,**p):
 p={'UUID':uid(),**p};actions.append({'WFWorkflowActionIdentifier':'is.workflow.actions.'+name,'WFWorkflowActionParameters':p});return p['UUID']
def ref(u,name):return {'Type':'ActionOutput','OutputUUID':u,'OutputName':name}
def attach(value):return {'Value':value,'WFSerializationType':'WFTextTokenAttachment'}
def text(*pieces):
 value='';attachments={}
 for p in pieces:
  if isinstance(p,dict):attachments['{%d, 1}'%len(value)]=p;value+='\ufffc'
  else:value+=p
 return {'Value':{'string':value,**({'attachmentsByRange':attachments} if attachments else {})},'WFSerializationType':'WFTextTokenString'}
def dictionary(items):
 return {'Value':{'WFDictionaryFieldValueItems':[{'WFItemType':0,'WFKey':text(k),'WFValue':text(v) if isinstance(v,str) else text(v)} for k,v in items.items()]},'WFSerializationType':'WFDictionaryFieldValue'}
action('comment',WFCommentActionText='Legal Edge steps pilot. Read-only Health access. Recent step samples are sent over HTTPS to your private account. The server uses one exact source, excludes today, rejects overlapping readings and reports a real saved-day receipt. Keep your key private. Test one upload against Health before scheduling. iOS may block Health reads while locked.')
key_index=len(actions);key=action('gettext',WFTextActionText='PASTE_YOUR_PRIVATE_KEY')
source_index=len(actions);source=action('gettext',WFTextActionText='Connect')
now=action('date',WFDateActionMode='Current Date')
today=action('format.date',WFDate=attach(ref(now,'Date')),WFDateFormatStyle='Custom',WFDateFormat='Custom',WFDateFormatString='yyyy-MM-dd')
type_row={'Bounded':True,'Operator':4,'Property':'Type','Removable':False,'Values':{'Enumeration':{'Value':'Steps','WFSerializationType':'WFStringSubstitutableState'}}}
date_row={'Bounded':False,'Operator':1001,'Property':'Start Date','Removable':True,'Values':{'Number':7,'Unit':16}}
filter_state={'Value':{'WFActionParameterFilterPrefix':1,'WFContentPredicateBoundedDate':False,'WFActionParameterFilterTemplates':[type_row,date_row]},'WFSerializationType':'WFContentPredicateTableTemplate'}
find=action('filter.health.quantity',WFContentItemFilter=filter_state,WFContentItemLimitEnabled=False)
group=uid();action('repeat.each',GroupingIdentifier=group,WFControlFlowMode=0,WFInput=attach(ref(find,'Health Samples')))
repeat={'Type':'Variable','VariableName':'Repeat Item'}
start=action('properties.health.quantity',WFContentItemPropertyName='Start Date',WFInput=attach(repeat))
start_fmt=action('format.date',WFDate=attach(ref(start,'Start Date')),WFDateFormatStyle='Custom',WFDateFormat='Custom',WFDateFormatString="yyyy-MM-dd'T'HH:mm:ssXXXXX")
end=action('properties.health.quantity',WFContentItemPropertyName='End Date',WFInput=attach(repeat))
end_fmt=action('format.date',WFDate=attach(ref(end,'End Date')),WFDateFormatStyle='Custom',WFDateFormat='Custom',WFDateFormatString="yyyy-MM-dd'T'HH:mm:ssXXXXX")
value=action('properties.health.quantity',WFContentItemPropertyName='Value',WFInput=attach(repeat))
sample_source=action('properties.health.quantity',WFContentItemPropertyName='Source',WFInput=attach(repeat))
action('gettext',WFTextActionText=text(ref(start_fmt,'Formatted Date'),'\t',ref(end_fmt,'Formatted Date'),'\t',ref(value,'Value'),'\t',ref(sample_source,'Source')))
loop_end=action('repeat.each',GroupingIdentifier=group,WFControlFlowMode=2)
combined=action('text.combine',WFInput=attach(ref(loop_end,'Repeat Results')),WFTextSeparator='New Lines')
response=action('downloadurl',WFURL='https://baxvhilvrhshlfizakak.supabase.co/functions/v1/health-device-ingest',WFHTTPMethod='POST',WFHTTPBodyType='JSON',WFHTTPHeaders=dictionary({'X-Legal-Edge-Key':ref(key,'Text')}),WFJSONValues=dictionary({'shortcut_version':'steps-v1','source_name':ref(source,'Text'),'local_today':ref(today,'Formatted Date'),'samples_tsv':ref(combined,'Combined Text')}))
# Show the actual JSON response: never infer success merely because a request was attempted.
action('showresult',Text=text('Server response: ',ref(response,'Contents of URL'),'\nA saved_days response proves receipt. Compare the previous complete day with your chosen Health source before adding an automation.'))
workflow={'WFWorkflowName':'Legal Edge Steps','WFWorkflowActions':actions,'WFWorkflowClientVersion':'2600.0','WFWorkflowMinimumClientVersion':900,'WFWorkflowMinimumClientVersionString':'900','WFWorkflowIcon':{'WFWorkflowIconGlyphNumber':59836,'WFWorkflowIconStartColor':946986751},'WFWorkflowHasOutputFallback':False,'WFWorkflowInputContentItemClasses':[],'WFWorkflowOutputContentItemClasses':[],'WFWorkflowTypes':[],'WFWorkflowImportQuestions':[{'ActionIndex':key_index,'Category':'Parameter','ParameterKey':'WFTextActionText','Text':'Paste the private setup key from your own Legal Edge account. Never share your completed shortcut.','DefaultValue':''},{'ActionIndex':source_index,'Category':'Parameter','ParameterKey':'WFTextActionText','Text':'Enter one exact step-source name from Health. Garmin is often Connect. The first server response lists available sources if this differs.','DefaultValue':'Connect'}]}
(OUT/'Legal-Edge-Steps.unsigned.shortcut').write_bytes(plistlib.dumps(workflow,fmt=plistlib.FMT_XML,sort_keys=False))
print('Built unsigned steps pilot:',len(actions),'preconfigured actions. Signing and iPhone verification required.')
